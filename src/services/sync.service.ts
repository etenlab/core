import {
  Node,
  NodeType,
  NodePropertyKey,
  NodePropertyValue,
} from '@eten-lab/models';
import axios from 'axios';
import {
  Relationship,
  RelationshipType,
  RelationshipPropertyKey,
  RelationshipPropertyValue,
} from '@eten-lab/models';
import { DbService } from './db.service';
import { SyncSessionRepository } from '../repositories/sync-session.repository';

interface SyncTable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entity: any;
  tableName: string;
  pkColumn: string; // since we have long column name (i.e. user.user_id) and short entiti's property name (i.e. user.id)
  pkProperty: string; // we want to distinguish them  explicitly.
}

const syncTables: SyncTable[] = [
  {
    entity: Node,
    tableName: 'nodes',
    pkColumn: 'node_id',
    pkProperty: 'id',
  },
  {
    entity: NodeType,
    tableName: 'node_types',
    pkColumn: 'type_name',
    pkProperty: 'type_name',
  },
  {
    entity: NodePropertyKey,
    tableName: 'node_property_keys',
    pkColumn: 'node_property_key_id',
    pkProperty: 'id',
  },
  {
    entity: NodePropertyValue,
    tableName: 'node_property_values',
    pkColumn: 'node_property_value_id',
    pkProperty: 'id',
  },
  {
    entity: Relationship,
    tableName: 'relationships',
    pkColumn: 'relationship_id',
    pkProperty: 'id',
  },
  {
    entity: RelationshipType,
    tableName: 'relationship_types',
    pkColumn: 'type_name',
    pkProperty: 'type_name',
  },
  {
    entity: RelationshipPropertyKey,
    tableName: 'relationship_property_keys',
    pkColumn: 'relationship_property_key_id',
    pkProperty: 'id',
  },
  {
    entity: RelationshipPropertyValue,
    tableName: 'relationship_property_values',
    pkColumn: 'relationship_property_value_id',
    pkProperty: 'id',
  },
];

interface SyncEntry {
  table: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
}

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

    console.log(`currentSyncLayer = ${this.currentSyncLayer}`);

    localStorage.setItem(CURRENT_SYNC_LAYER_KEY, String(this.currentSyncLayer));
  }

  private setLastSyncLayer(value: number) {
    this.lastLayerSync = value;

    console.log(`lastSyncLayer = ${this.lastLayerSync}`);

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
    console.log(`Sync: from ${fromSyncLayer} to ${toSyncLayer}`);
    this.incrementSyncCounter();

    const syncData: SyncEntry[] = [];

    for (const table of syncTables) {
      const items = await this.dbService.dataSource
        .getRepository(table.entity)
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
      console.log('Nothing to sync out');
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

    console.log(
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

    console.log('Starting sync out...');

    try {
      const response = await axios.post(
        `${this.serverUrl}/sync/to-server`,
        entries,
        {},
      );

      return response.data;
    } catch (err) {
      console.log('Sync failed');

      throw err;
    }
  }

  async syncIn() {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');

    console.log('Starting sync in...');

    const lastSyncParam = this.getLastSyncFromServerTime();

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = {} as any;

      if (lastSyncParam) {
        params['last-sync'] = lastSyncParam;
        console.log(`Doing sync from ${lastSyncParam}`);
      } else {
        console.log('Doing first sync');
      }

      const response = await axios.get(`${this.serverUrl}/sync/from-server`, {
        params,
      });

      const data = response.data as { lastSync: string; entries: SyncEntry[] };

      const lastSync = data.lastSync;
      const entries = data.entries;

      if (entries.length === 0) {
        console.log('No new sync entries from server');
        return null;
      }

      await this.saveSyncEntries(entries);

      this.setLastSyncFromServerTime(lastSync);
      return;
    } catch (err) {
      console.log('Sync failed');

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
      console.log('Nothing to sync in');
    } else {
      console.log('Saving sync entries...');
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

        const existing = await this.dbService.dataSource
          .getRepository(entity)
          .createQueryBuilder()
          .select('*')
          .where(`${pkColumn} = :pkValue`, {
            pkValue,
          })
          .execute();

        if (existing.length) {
          const q = this.dbService.dataSource
            .getRepository(entity)
            .createQueryBuilder()
            .update(entity)
            .set({ [pkProperty]: pkValue }) //typeorm wants propery name as key here
            //typeorm wants column name as clause here
            .where(`${pkColumn} = :pkValue`, {
              pkValue,
            });
          console.log(q.getSql(), q.getParameters());
          await q.execute();
        } else {
          const q = this.dbService.dataSource
            .getRepository(entity)
            .createQueryBuilder()
            .insert()
            .into(entity)
            .values({ ...row, [pkProperty]: row[pkColumn] }); //typeorm wants propery name as key here
          console.log(q.getSql(), q.getParameters());
          await q.execute();
        }
      }
    }

    console.log('Sync entries saved');
  }
}
