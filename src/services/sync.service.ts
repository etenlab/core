import axios from 'axios';
import { ObjectLiteral, EntityTarget } from 'typeorm';
import pako from 'pako';
import buffer from 'buffer';

import {
  Node,
  NodeType,
  NodePropertyKey,
  NodePropertyValue,
  Relationship,
  RelationshipType,
  RelationshipPropertyKey,
  RelationshipPropertyValue,
  ElectionType,
  Election,
  Candidate,
  Vote,
} from '@eten-lab/models';

import { SyncSessionRepository } from '../repositories/sync-session.repository';

import { DbService } from './db.service';
import { LoggerService } from './logger.service';

import { TableNameConst } from '@eten-lab/models';

interface SyncTable {
  entity: unknown;
  tableName: string;
  pkColumn: string; // since we have long column name (i.e. user.user_id) and short entiti's property name (i.e. user.id)
  pkProperty: string; // we want to distinguish them  explicitly.
}

const syncTables: SyncTable[] = [
  {
    entity: Node,
    tableName: TableNameConst.NODES,
    pkColumn: 'node_id',
    pkProperty: 'id',
  },
  {
    entity: NodeType,
    tableName: TableNameConst.NODE_TYPES,
    pkColumn: 'type_name',
    pkProperty: 'type_name',
  },
  {
    entity: NodePropertyKey,
    tableName: TableNameConst.NODE_PROPERTY_KEYS,
    pkColumn: 'node_property_key_id',
    pkProperty: 'id',
  },
  {
    entity: NodePropertyValue,
    tableName: TableNameConst.NODE_PROPERTY_VALUES,
    pkColumn: 'node_property_value_id',
    pkProperty: 'id',
  },
  {
    entity: Relationship,
    tableName: TableNameConst.RELATIONSHIPS,
    pkColumn: 'relationship_id',
    pkProperty: 'id',
  },
  {
    entity: RelationshipType,
    tableName: TableNameConst.RELATIONSHIP_TYPES,
    pkColumn: 'type_name',
    pkProperty: 'type_name',
  },
  {
    entity: RelationshipPropertyKey,
    tableName: TableNameConst.RELATIONSHIP_PROPERTY_KEYS,
    pkColumn: 'relationship_property_key_id',
    pkProperty: 'id',
  },
  {
    entity: RelationshipPropertyValue,
    tableName: TableNameConst.RELATIONSHIP_PROPERTY_VALUES,
    pkColumn: 'relationship_property_value_id',
    pkProperty: 'id',
  },
  {
    entity: ElectionType,
    tableName: TableNameConst.ELECTION_TYPES,
    pkColumn: 'type_name',
    pkProperty: 'type_name',
  },
  {
    entity: Election,
    tableName: TableNameConst.ELECTIONS,
    pkColumn: 'election_id',
    pkProperty: 'id',
  },
  {
    entity: Candidate,
    tableName: TableNameConst.CANDIDATES,
    pkColumn: 'candidate_id',
    pkProperty: 'id',
  },
  {
    entity: Vote,
    tableName: TableNameConst.VOTES,
    pkColumn: 'vote_id',
    pkProperty: 'id',
  },
];

interface SyncEntry {
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
}

export type DatabaseDTO = {
  [TableNameConst.NODE_TYPES]: unknown[];
  [TableNameConst.NODES]: unknown[];
  [TableNameConst.NODE_PROPERTY_KEYS]: unknown[];
  [TableNameConst.NODE_PROPERTY_VALUES]: unknown[];
  [TableNameConst.RELATIONSHIP_TYPES]: unknown[];
  [TableNameConst.RELATIONSHIPS]: unknown[];
  [TableNameConst.RELATIONSHIP_PROPERTY_KEYS]: unknown[];
  [TableNameConst.RELATIONSHIP_PROPERTY_VALUES]: unknown[];
  [TableNameConst.ELECTION_TYPES]: unknown[];
  [TableNameConst.ELECTIONS]: unknown[];
  [TableNameConst.CANDIDATES]: unknown[];
  [TableNameConst.VOTES]: unknown[];
};

const CURRENT_SYNC_LAYER_KEY = 'syncLayer';
const LAST_SYNC_LAYER_KEY = 'lastSyncLayer';
const LAST_SYNC_FROM_SERVER_KEY = 'lastSyncFromServer';
export class SyncService {
  private currentSyncLayer: number;
  private lastLayerSync: number;
  private readonly serverUrl: string;

  constructor(
    private readonly dbService: DbService,
    private readonly syncSessionRepository: SyncSessionRepository,
    private readonly logger: LoggerService,
  ) {
    this.currentSyncLayer = Number(
      localStorage.getItem(CURRENT_SYNC_LAYER_KEY) || '0',
    );

    if (!process.env.REACT_APP_CPG_SERVER_URL) {
      throw new Error('REACT_APP_CPG_SERVER_URL not set');
    }

    this.serverUrl = process.env.REACT_APP_CPG_SERVER_URL;

    this.lastLayerSync = Number(
      localStorage.getItem(LAST_SYNC_LAYER_KEY) || '-1',
    );
  }

  get syncLayer() {
    return this.currentSyncLayer;
  }

  private incrementSyncCounter() {
    this.currentSyncLayer++;

    this.logger.info(`currentSyncLayer = ${this.currentSyncLayer}`);

    localStorage.setItem(CURRENT_SYNC_LAYER_KEY, String(this.currentSyncLayer));
  }

  private setLastSyncLayer(value: number) {
    this.lastLayerSync = value;

    this.logger.info(`lastSyncLayer = ${this.lastLayerSync}`);

    localStorage.setItem(LAST_SYNC_LAYER_KEY, String(this.lastLayerSync));
  }

  private setLastSyncFromServerTime(isoString: string) {
    localStorage.setItem(LAST_SYNC_FROM_SERVER_KEY, isoString);
  }

  private getLastSyncFromServerTime() {
    return localStorage.getItem(LAST_SYNC_FROM_SERVER_KEY);
  }

  async syncOut() {
    const toSyncLayer = this.currentSyncLayer;
    const fromSyncLayer = this.lastLayerSync + 1;
    this.logger.info(`Sync: from ${fromSyncLayer} to ${toSyncLayer}`);
    this.incrementSyncCounter();

    const syncData: SyncEntry[] = [];

    for (const table of syncTables) {
      const items = await this.dbService.dataSource
        .getRepository(table.entity as EntityTarget<ObjectLiteral>)
        .createQueryBuilder()
        .select('*')
        .where('sync_layer >= :fromSyncLayer', {
          fromSyncLayer,
        })
        .andWhere('sync_layer <= :toSyncLayer', {
          toSyncLayer,
        })
        .execute();

      if (!items.length) continue;

      for (const item of items) {
        delete item.sync_layer;
      }

      syncData.push({
        table: table.tableName,
        rows: items,
      });
    }

    if (syncData.length === 0) {
      this.logger.info('Nothing to sync out');
      return null;
    }

    const sessionId = await this.syncSessionRepository.createSyncSession(
      fromSyncLayer,
      toSyncLayer,
    );

    try {
      await this.syncToServer(syncData);
    } catch (err) {
      await this.syncSessionRepository.completeSyncSession(
        sessionId,
        new Error(String(err)),
      );
      throw err;
    }

    await this.syncSessionRepository.completeSyncSession(sessionId);

    this.logger.info(
      `Sync completed successfully (${
        syncData.length
      } tables, ${syncData.reduce(
        (sum, c) => sum + c.rows.length,
        0,
      )} entries)`,
    );

    this.setLastSyncLayer(toSyncLayer);

    return syncData;
  }

  private async syncToServer(entries: SyncEntry[]) {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    this.logger.info('Starting sync out...');

    try {
      const response = await axios.post(
        `${this.serverUrl}/sync/to-server`,
        entries,
        {},
      );

      return response.data;
    } catch (err) {
      this.logger.error('Sync failed');

      throw err;
    }
  }

  async syncIn() {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    this.logger.info('Starting sync in...');

    const lastSyncParam = this.getLastSyncFromServerTime();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = {} as any;

      if (lastSyncParam) {
        params['last-sync'] = lastSyncParam;
        this.logger.info(`Doing sync from ${lastSyncParam}`);
      } else {
        this.logger.info('Doing first sync');
      }

      const response = await axios.get(`${this.serverUrl}/sync/from-server`, {
        params,
      });

      const data = response.data as { lastSync: string; entries: SyncEntry[] };

      const lastSync = data.lastSync;
      const entries = data.entries;

      if (entries.length === 0) {
        this.logger.info('No new sync entries from server');
        return null;
      }

      await this.saveSyncEntries(entries);

      this.setLastSyncFromServerTime(lastSync);
      return;
    } catch (err) {
      this.logger.error('Sync failed');

      throw err;
    }
  }

  /**
   *
   * @param entries - Note: entries.rows has raw column names. We must pay attention on correct composition typeOrm
   * query builder, especially with primary keys.
   */
  private async saveSyncEntries(entries: SyncEntry[]) {
    if (entries.length < 1) {
      this.logger.info('Nothing to sync in');
    } else {
      this.logger.info('Saving sync entries...');
    }

    for (const entry of entries) {
      const table = entry.table;
      const rows = entry.rows;

      const syncTable = syncTables.find(t => t.tableName === table);

      if (syncTable == null) {
        throw new Error(`Unknown table ${table}`);
      }

      const { entity, pkColumn, pkProperty } = syncTable;

      for (const row of rows) {
        const pkValue = row[pkColumn];

        delete row[pkColumn];

        row[pkProperty] = pkValue;

        const existing = await this.dbService.dataSource
          .getRepository(entity as EntityTarget<ObjectLiteral>)
          .find({
            where: {
              [pkProperty]: pkValue,
            },
          });

        if (existing.length) {
          this.dbService.dataSource
            .getRepository(entity as EntityTarget<ObjectLiteral>)
            .update({ [pkProperty]: pkValue }, { ...row });
        } else {
          this.dbService.dataSource
            .getRepository(entity as EntityTarget<ObjectLiteral>)
            .insert({ ...row });
        }
      }
    }

    this.logger.info('Sync entries saved');
  }

  async getGzipJsonDB() {
    const db: DatabaseDTO = {
      [TableNameConst.NODE_TYPES]: [],
      [TableNameConst.NODES]: [],
      [TableNameConst.NODE_PROPERTY_KEYS]: [],
      [TableNameConst.NODE_PROPERTY_VALUES]: [],
      [TableNameConst.RELATIONSHIP_TYPES]: [],
      [TableNameConst.RELATIONSHIPS]: [],
      [TableNameConst.RELATIONSHIP_PROPERTY_KEYS]: [],
      [TableNameConst.RELATIONSHIP_PROPERTY_VALUES]: [],
      [TableNameConst.ELECTION_TYPES]: [],
      [TableNameConst.ELECTIONS]: [],
      [TableNameConst.CANDIDATES]: [],
      [TableNameConst.VOTES]: [],
    };

    for (const table of syncTables) {
      const items = await this.dbService.dataSource
        .getRepository(table.entity as EntityTarget<ObjectLiteral>)
        .createQueryBuilder()
        .select('*')
        .execute();

      if (!items.length) continue;

      for (const item of items) {
        delete item.sync_layer;
        if (table.tableName === TableNameConst.ELECTIONS) {
          if (item.site_text) {
            item.site_text = true;
          }
          if (item.site_text_translation) {
            item.site_text_translation = true;
          }
        }
      }

      db[table.tableName as keyof typeof db] = items;
    }

    const dbJson = {
      lastSync: this.getLastSyncFromServerTime(),
      db,
    };

    const compressed = pako.deflate(JSON.stringify(dbJson));

    const blob = new Blob([compressed], {
      type: 'text/plain',
    });

    const file = new File([blob], 'db.json.gz');

    return file;
  }

  async syncOutViaJsonDB() {
    const toSyncLayer = this.currentSyncLayer;
    const fromSyncLayer = this.lastLayerSync + 1;
    this.incrementSyncCounter();
    this.logger.info(`Starting sync out via db.json...`);

    const file = await this.getGzipJsonDB();

    const sessionId = await this.syncSessionRepository.createSyncSession(
      fromSyncLayer,
      toSyncLayer,
    );

    try {
      await this.syncToServerViaJson(file);
    } catch (err) {
      await this.syncSessionRepository.completeSyncSession(
        sessionId,
        new Error(String(err)),
      );
      throw err;
    }

    await this.syncSessionRepository.completeSyncSession(sessionId);

    this.setLastSyncLayer(toSyncLayer);
  }

  private async syncToServerViaJson(file: File) {
    this.logger.info('Starting sync out...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(
        `${this.serverUrl}/sync/to-server-via-json`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data;',
            'Content-Disposition': 'form-data; name="map"; filename="db.json"',
          },
        },
      );

      await this.saveSyncEntriesViaJson(response.data);
    } catch (err) {
      this.logger.error('Sync failed');

      throw err;
    }
  }

  async syncInViaJson() {
    this.logger.info('Starting sync in via db.json...');

    try {
      const response = await axios.get(
        `${this.serverUrl}/sync/from-server-via-json`,
      );

      await this.saveSyncEntriesViaJson(response.data);

      return;
    } catch (err) {
      this.logger.error('Sync failed');

      throw err;
    }
  }

  async syncInViaJsonFile(file: File) {
    this.logger.info('Starting sync in via db.json.gz...');

    let dbJson: {
      lastSync: string;
      db: DatabaseDTO;
    };

    try {
      const arrayBuffer = await file.arrayBuffer();
      dbJson = JSON.parse(pako.inflate(arrayBuffer, { to: 'string' }));
    } catch (err) {
      this.logger.error('inflate error', err);
      return;
    }

    const entries: SyncEntry[] = Object.keys(dbJson.db).map(key => {
      return {
        table: key,
        rows: dbJson.db[key as keyof typeof dbJson.db],
      };
    });

    await this.saveSyncEntries(entries);

    this.setLastSyncFromServerTime(dbJson.lastSync);
  }

  /**
   *
   * @param entries - Note: entries.rows has raw column names. We must pay attention on correct composition typeOrm
   * query builder, especially with primary keys.
   */
  private async saveSyncEntriesViaJson(data: string) {
    let dbJson: {
      lastSync: string;
      db: DatabaseDTO;
    };

    try {
      const uint8array = buffer.Buffer.from(data, 'binary');
      dbJson = JSON.parse(pako.inflate(uint8array, { to: 'string' })) as {
        lastSync: string;
        db: DatabaseDTO;
      };
    } catch (err) {
      this.logger.error('inflate error', err);
      return;
    }

    const entries: SyncEntry[] = Object.keys(dbJson.db).map(key => {
      return {
        table: key,
        rows: dbJson.db[key as keyof typeof dbJson.db],
      };
    });

    await this.saveSyncEntries(entries);

    this.setLastSyncFromServerTime(dbJson.lastSync);
  }

  clearAllSyncInfo() {
    localStorage.removeItem(CURRENT_SYNC_LAYER_KEY);
    localStorage.removeItem(LAST_SYNC_LAYER_KEY);
    localStorage.removeItem(LAST_SYNC_FROM_SERVER_KEY);
  }
}
