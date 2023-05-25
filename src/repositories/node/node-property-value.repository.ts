import { NodePropertyKey, NodePropertyValue } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

export class NodePropertyValueRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(NodePropertyValue);
  }

  /**
   * This function create a node property value by give key_id, and key_value.
   * Feature: node property value is immutable data, no update, and no duplicate.
   *
   * @param key_id
   * @param key_value
   * @returns
   */
  async createNodePropertyValue(
    key_id: Nanoid,
    key_value: unknown,
  ): Promise<Nanoid> {
    const node_property_key = await this.dbService.dataSource
      .getRepository(NodePropertyKey)
      .findOneBy({ id: key_id });

    if (node_property_key === null) {
      throw new Error(`Not exists property key by given #key_id='${key_id}'`);
    }

    const nodePropertyValue = await this.repository.findOne({
      where: {
        node_property_key_id: key_id,
      },
    });

    if (nodePropertyValue) {
      throw new Error(`Already exists propertyValue!`);
    }

    const new_property_value_instance = this.repository.create({
      property_value: JSON.stringify({ value: key_value }),
      node_property_key_id: key_id,
      sync_layer: this.syncService.syncLayer,
    } as NodePropertyValue);

    new_property_value_instance.propertyKey = node_property_key;

    const node_property_value = await this.repository.save(
      new_property_value_instance,
    );

    return node_property_value.id;
  }

  /**
   * @deprecated
   *
   * This is wrong method, Never use it, and delete all you used
   *
   * @param key_id
   * @param key_value
   * @returns
   */
  async setNodePropertyValue(
    key_id: Nanoid,
    key_value: unknown,
  ): Promise<Nanoid> {
    const node_property_key = await this.dbService.dataSource
      .getRepository(NodePropertyKey)
      .findOneBy({ id: key_id });

    if (node_property_key === null) {
      throw new Error(`Not exists property key by given #key_id='${key_id}'`);
    }

    const nodePropertyValue = await this.repository.findOne({
      where: {
        node_property_key_id: key_id,
      },
    });

    if (nodePropertyValue) {
      await this.repository.update(nodePropertyValue.id, {
        property_value: JSON.stringify({ value: key_value }),
        sync_layer: this.syncService.syncLayer,
      });

      return nodePropertyValue.id;
    } else {
      return this.createNodePropertyValue(key_id, key_value);
    }
  }
}
