import { Node, NodePropertyKey, TableNameConst } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';
import { nanoid } from 'nanoid';

export class NodePropertyKeyRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(NodePropertyKey);
  }

  async createNodePropertyKey(
    node_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid> {
    const propertyKey = await this.findNodePropertyKey(node_id, key_name);

    if (propertyKey !== null) {
      throw new Error(
        `Already Exists property key with same #key_name='${key_name}' at #node_id='${node_id}'`,
      );
    }

    const node = await this.dbService.dataSource
      .getRepository(Node)
      .findOneBy({ id: node_id });

    if (node === null) {
      throw new Error(
        `Not Exists node at node table with #node_id='${node_id}'`,
      );
    }

    const new_property_key_instance = this.repository.create({
      property_key: key_name,
      node_id,
      sync_layer: this.syncService.syncLayer,
    });

    new_property_key_instance.node = node;

    const new_property_key = await this.repository.save(
      new_property_key_instance,
    );

    return new_property_key.id;
  }
  
  /**
   * No checks on dubpication (for performance reasons), use with caution!
   */  
  async createNodePropertyKeyNoChekcs(
    node_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid> {
    let insertNpkSQL = `
      INSERT INTO ${TableNameConst.NODE_PROPERTY_KEYS} (node_property_key_id, property_key, node_id, updated_at, sync_layer)
      VALUES
    `
    const id = nanoid()
    insertNpkSQL += `('${id}','${key_name}','${node_id}','${new Date().toISOString()}',${this.syncService.syncLayer})`
    await this.dbService.dataSource.query(insertNpkSQL)
    return id;    
  }
  


  async findNodePropertyKey(
    node_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid | null> {
    const nodePropertyKey = await this.repository.findOne({
      where: {
        property_key: key_name,
        node_id: node_id,
      },
    });

    return nodePropertyKey?.id || null;
  }

  /**
   * @deprecated
   * Never use this function, because graph-schema is immutable data-structure.
   * If you want to get a propertyKey id, use findPropertyKey()
   * And if you want to create a new propertyKey entity, then user createNodePropertyKey() function
   *
   * @param node_id
   * @param key_name
   * @returns
   */
  async getNodePropertyKey(node_id: Nanoid, key_name: string): Promise<Nanoid> {
    const propertyKeyId = await this.findNodePropertyKey(node_id, key_name);

    if (propertyKeyId) {
      return propertyKeyId;
    } else {
      return this.createNodePropertyKey(node_id, key_name);
    }
  }

  async bulkSave(entities: NodePropertyKey[]) {
    return this.repository.save(entities, { transaction: true });
  }
}
