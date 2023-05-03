import { Relationship, RelationshipPropertyKey } from '@eten-lab/models';
import { type DbService } from '@/services/db.service';
import { type SyncService } from '@/services/sync.service';

export class RelationshipPropertyKeyRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(RelationshipPropertyKey);
  }

  private async createRelationshipPropertyKey(
    rel_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid> {
    const property_key = await this.findPropertyKey(rel_id, key_name);

    if (property_key !== null) {
      throw new Error(
        `Already exists property key with #key_name='${key_name}'`,
      );
    }

    const relationship = await this.dbService.dataSource
      .getRepository(Relationship)
      .findOneBy({
        id: rel_id,
      });

    if (relationship === null) {
      throw new Error(
        `Not Exists relationship at relationship table with #rel_id='${rel_id}'`,
      );
    }

    const new_property_key_instance = this.repository.create({
      property_key: key_name,
      sync_layer: this.syncService.syncLayer,
      relationship_id: rel_id,
    } as RelationshipPropertyKey);

    new_property_key_instance.relationship = relationship;

    const new_property_key = await this.repository.save(
      new_property_key_instance,
    );

    return new_property_key.id;
  }

  private async findPropertyKey(
    rel_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid | null> {
    const relationshipPropertyKey = await this.repository.findOne({
      where: {
        property_key: key_name,
        relationship_id: rel_id,
      },
    });

    return relationshipPropertyKey?.id || null;
  }

  async getRelationshipPropertyKey(
    rel_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid> {
    const propertyKeyId = await this.findPropertyKey(rel_id, key_name);

    if (propertyKeyId) {
      return propertyKeyId;
    } else {
      return this.createRelationshipPropertyKey(rel_id, key_name);
    }
  }
}
