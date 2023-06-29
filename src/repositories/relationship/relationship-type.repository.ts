import { RelationshipType } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

export class RelationshipTypeRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(RelationshipType);
  }

  async createRelationshipType(type_name: string): Promise<string> {
    let relationship_type = await this.repository.findOneBy({ type_name });

    if (relationship_type === null) {
      relationship_type = await this.repository.save({
        type_name,
        sync_layer: this.syncService.syncLayer,
      } as RelationshipType);
    }

    return relationship_type.type_name;
  }

  async listRelationshipTypes(): Promise<RelationshipType[]> {
    const relationship_types = await this.repository.find({
      select: ['type_name'],
    });

    return relationship_types;
  }
}
