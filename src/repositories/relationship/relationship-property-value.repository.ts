import { RelationshipPropertyKey, RelationshipPropertyValue } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

export class RelationshipPropertyValueRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(RelationshipPropertyValue);
  }

  /**
   * This function create a relationship property value by give key_id, and key_value.
   * Feature: relationship property value is immutable data, no update, and no duplicate.
   *
   * @param key_id
   * @param key_value
   * @returns
   */
  async createRelationshipPropertyValue(
    key_id: Nanoid,
    key_value: unknown,
  ): Promise<Nanoid> {
    const rel_property_key = await this.dbService.dataSource
      .getRepository(RelationshipPropertyKey)
      .findOneBy({ id: key_id });

    if (rel_property_key === null) {
      throw new Error(`Not Exists property key with #key_id='${key_id}'`);
    }

    const new_property_value_instance = this.repository.create({
      property_value: JSON.stringify({ value: key_value }),
      sync_layer: this.syncService.syncLayer,
      relationship_property_key_id: key_id,
    });

    new_property_value_instance.propertyKey = rel_property_key;

    const relationship_property_value = await this.repository.save(
      new_property_value_instance,
    );

    return relationship_property_value.id;
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
  async setRelationshipPropertyValue(
    key_id: Nanoid,
    key_value: unknown,
  ): Promise<Nanoid> {
    const rel_property_key = await this.dbService.dataSource
      .getRepository(RelationshipPropertyKey)
      .findOneBy({ id: key_id });

    if (rel_property_key === null) {
      throw new Error(`Not Exists property key with #key_id='${key_id}'`);
    }

    const relationshipPropertyValue = await this.repository.findOne({
      where: {
        relationship_property_key_id: key_id,
      },
    });

    if (relationshipPropertyValue) {
      await this.repository.update(relationshipPropertyValue.id, {
        property_value: JSON.stringify({ value: key_value }),
        sync_layer: this.syncService.syncLayer,
      });

      return relationshipPropertyValue.id;
    } else {
      return this.createRelationshipPropertyValue(key_id, key_value);
    }
  }
}
