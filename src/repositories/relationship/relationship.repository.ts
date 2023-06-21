import { FindOptionsWhere } from 'typeorm';
import { nanoid } from 'nanoid';

import { Node, Relationship, RelationshipType, TableNameConst } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

import { PropertyKeyConst } from '../../constants/graph.constant';
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

  async createFromManyRelsNoChecks(
    fromNodes: Array<Nanoid>,
    node_2: Nanoid,
    type_name: string,
  ): Promise<void> {
    const relsData:Array<Partial<Relationship>> = fromNodes.map((n) => ({
      from_node_id: n,
      to_node_id: node_2,
      relationship_type: type_name,
      sync_layer: this.syncService.syncLayer,
    }))
    
    let insertRelationshipsSQL = `
      INSERT INTO ${TableNameConst.RELATIONSHIPS} (sync_layer, relationship_id, relationship_type, from_node_id, to_node_id, updated_at)
      VALUES 
    `
    let comma=''
    for (const {from_node_id, to_node_id, relationship_type, sync_layer } of relsData) {
      if (!from_node_id || !to_node_id || !relationship_type || isNaN(Number(sync_layer))) continue;
      insertRelationshipsSQL += comma + `(${sync_layer}, '${nanoid()}','${relationship_type}','${from_node_id}','${to_node_id}','${new Date().toISOString()}')`
      comma= ','
    }
    await this.dbService.dataSource.query(insertRelationshipsSQL)
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

    const rel = await this.repository.findOne({
      where: {
        relationship_type: type_name,
        from_node_id: node_from.id,
        to_node_id: node_to.id,
      },
    });

    return rel;
  }

  async listAllRelationshipsByType(type_name: string): Promise<Relationship[]> {
    const relationships = await this.repository
      .createQueryBuilder('rel')
      .leftJoinAndSelect('rel.relationshipType', 'relationship_type')
      .where('rel.relationship_type = :type_name', { type_name })
      .getMany();

    return relationships;
  }

  async readRelationship(
    rel_id: Nanoid,
    relations?: string[],
    whereObj?: FindOptionsWhere<Relationship>,
  ): Promise<Relationship | null> {
    if (relations) {
      if (whereObj) {
        return this.repository.findOne({
          relations,
          where: whereObj,
        });
      } else {
        return this.repository.findOne({
          relations,
          where: {
            id: rel_id,
          },
        });
      }
    } else {
      return this.repository.findOne({
        where: {
          id: rel_id,
        },
      });
    }
  }

  async getRelationshipPropertyValue(
    relId: Nanoid,
    propertyName: PropertyKeyConst,
  ): Promise<unknown> {
    const relEntity = await this.readRelationship(relId, [
      'propertyKeys',
      'propertyKeys.propertyValue',
    ]);

    if (!relEntity) {
      return null;
    }

    if (!relEntity.propertyKeys?.length || relEntity.propertyKeys?.length < 1) {
      return null;
    }

    const propertyIdx = relEntity.propertyKeys.findIndex(
      (pk) => pk.property_key === propertyName,
    );

    const resJson =
      relEntity.propertyKeys[propertyIdx].propertyValue.property_value;
    const res = JSON.parse(resJson).value;

    return res;
  }
}
