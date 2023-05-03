import { Node, Relationship, RelationshipType } from '@eten-lab/models';
import { type DbService } from '@/services/db.service';
import { type SyncService } from '@/services/sync.service';

export class RelationshipRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(Relationship);
  }

  async createRelationship(
    node_1: Nanoid,
    node_2: Nanoid,
    type_name: string,
  ): Promise<Relationship> {
    const nodeRepo = this.dbService.dataSource.getRepository(Node);
    const node_from = await nodeRepo.findOneBy({ id: node_1 });
    const node_to = await nodeRepo.findOneBy({ id: node_2 });

    if (!node_from) {
      throw new Error(`Node not found '${node_1}'`);
    }
    if (!node_to) {
      throw new Error(`Node not found '${node_2}'`);
    }

    let relType = await this.dbService.dataSource
      .getRepository(RelationshipType)
      .findOneBy({ type_name });

    if (relType === null) {
      relType = await this.dbService.dataSource
        .getRepository(RelationshipType)
        .save({ type_name });
    }

    const new_relationship_instance = this.repository.create({
      fromNode: node_from,
      toNode: node_to,
      relationshipType: relType,
      relationship_type: type_name,
      sync_layer: this.syncService.syncLayer,
    });

    const relationship = await this.repository.save(new_relationship_instance);

    return relationship;
  }

  async findRelationship(
    node_1: Nanoid,
    node_2: Nanoid,
    type_name: string,
  ): Promise<Relationship | null> {
    const nodeRepo = this.dbService.dataSource.getRepository(Node);
    const node_from = await nodeRepo.findOneBy({ id: node_1 });
    const node_to = await nodeRepo.findOneBy({ id: node_2 });

    if (!node_from) {
      throw new Error(`Node not found '${node_1}'`);
    }
    if (!node_to) {
      throw new Error(`Node not found '${node_2}'`);
    }

    const translation = await this.repository.findOne({
      where: {
        relationship_type: type_name,
        from_node_id: node_from.id,
        to_node_id: node_to.id,
      },
    });

    return translation;
  }

  async listAllRelationshipsByType(type_name: string): Promise<Relationship[]> {
    const relationships = await this.repository
      .createQueryBuilder('rel')
      .leftJoinAndSelect('rel.relationshipType', 'relationship_type')
      .where('rel.relationship_type = :type_name', { type_name })
      .getMany();

    return relationships;
  }

  async readRelationship(rel_id: Nanoid): Promise<Relationship | null> {
    const relationship = await this.repository.findOneBy({
      id: rel_id,
    });

    return relationship;
  }

  // async listRelatedNodes(node_id: string): Promise<any> {
  //   const relationships_from = await this.repository.findBy({
  //     to_id: node_id,
  //   });
  //   const related_from = relationships_from.map((rel) => {
  //     return {
  //       relationship: rel,
  //       node: rel.from_node,
  //     };
  //   });

  //   const relationships_to = await this.repository.findBy({
  //     from_id: node_id,
  //   });
  //   const related_to = relationships_to.map((rel) => {
  //     return {
  //       relationship: rel,
  //       node: rel.to_node,
  //     };
  //   });

  //   return related_from.concat(related_to);
  // }
}
