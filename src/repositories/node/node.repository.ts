import { FindOptionsWhere, In } from 'typeorm';

import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';
import { Node, NodeType, TableNameConst } from '@eten-lab/models';

import {
  NodeTypeConst,
  PropertyKeyConst,
  RelationshipTypeConst,
} from '../../constants/graph.constant';
import { nanoid } from 'nanoid';
export interface getNodesByTypeAndRelatedNodesParams {
  type: NodeTypeConst;
  from_node_id?: Nanoid;
  to_node_id?: Nanoid;
  onlyWithProps?: { key: string; value: string }[]
}

export class NodeRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(Node);
  }

  async createNode(type_name: string): Promise<Node> {
    let nodeType = await this.dbService.dataSource
      .getRepository(NodeType)
      .findOneBy({ type_name });

    if (nodeType === null) {
      nodeType = await this.dbService.dataSource
        .getRepository(NodeType)
        .save({ type_name });
    }

    const new_node = this.repository.create({
      nodeType,
      node_type: type_name,
      sync_layer: this.syncService.syncLayer,
    });
    const node = await this.repository.save(new_node);

    return node;
  }
  
  async createNodes(type_name: string, amount: number): Promise<Array<Nanoid>> {
    if (isNaN(Number(amount)) || amount < 1) return [];
    let nodeType = await this.dbService.dataSource
      .getRepository(NodeType)
      .findOneBy({ type_name });
    if (nodeType === null) {
      nodeType = await this.dbService.dataSource
        .getRepository(NodeType)
        .save({ type_name });
    }
    let insertNodesSQL = `
      INSERT INTO ${TableNameConst.NODES} (node_id, node_type, updated_at, sync_layer)
      VALUES
    `
    let comma = ''
    const ids:Nanoid[]=[]
    for (let i = 0; i < amount; i++) {
      ids[i] = nanoid()
      insertNodesSQL += comma + `('${ids[i]}','${type_name}','${new Date().toISOString()}',${this.syncService.syncLayer})`
      comma=','
    }
    await this.dbService.dataSource.query(insertNodesSQL)
    return ids;
  }

  async listAllNodesByType(type_name: string): Promise<Node[]> {
    const nodes = await this.repository.find({
      relations: ['propertyKeys', 'propertyKeys.propertyValue'],
      select: {
        propertyKeys: {
          property_key: true,
          propertyValue: {
            property_value: true,
          },
        },
      },
      where: {
        node_type: type_name,
      },
    });
    return nodes;
  }

  async readNode(
    node_id: Nanoid,
    relations?: string[],
    whereObj?: FindOptionsWhere<Node>,
  ): Promise<Node | null> {
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
            id: node_id,
          },
        });
      }
    } else {
      return this.repository.findOne({
        where: {
          id: node_id,
        },
      });
    }
  }

  async findOne(
    relations: string[],
    whereObj: FindOptionsWhere<Node>,
  ): Promise<Node | null> {
    return this.repository.findOne({
      relations,
      where: whereObj,
    });
  }

  async find(
    relations: string[],
    whereObj: FindOptionsWhere<Node>,
  ): Promise<Node[]> {
    return this.repository.find({
      relations,
      where: whereObj,
    });
  }

  async getNodeByProp(
    type: string,
    prop: { key: string; value: unknown },
    relationship?: {
      relationship_type?: string;
      from_node_id?: Nanoid;
      to_node_id?: Nanoid;
    },
  ): Promise<Node | null> {
    const relationsArray = ['propertyKeys', 'propertyKeys.propertyValue'];
    const whereObj: FindOptionsWhere<Node> = {
      node_type: type,
      propertyKeys: {
        property_key: prop.key,
        propertyValue: {
          property_value: JSON.stringify({ value: prop.value }),
        },
      },
    };

    if (relationship) {
      if (relationship.from_node_id) {
        relationsArray.push('fromNodeRelationships');
        whereObj.fromNodeRelationships = {};
        whereObj.fromNodeRelationships.from_node_id = relationship.from_node_id;
        if (relationship.relationship_type) {
          whereObj.fromNodeRelationships.relationship_type =
            relationship.relationship_type;
        }
      }

      if (relationship.to_node_id) {
        relationsArray.push('toNodeRelationships');
        whereObj.toNodeRelationships = {};
        whereObj.toNodeRelationships.to_node_id = relationship.to_node_id;
        if (relationship.relationship_type) {
          whereObj.toNodeRelationships.relationship_type =
            relationship.relationship_type;
        }
      }
    }

    const node = await this.repository.findOne({
      relations: relationsArray,
      where: whereObj,
    });

    return node;
  }

  async getNodesIdsByPropAndRelTypes(
    nodeType: string,
    prop: { key: string; value: string }[],
    relationshipTypes: RelationshipTypeConst[],
  ): Promise<Nanoid[]> {
    const relationsArray = [
      'propertyKeys',
      'propertyKeys.propertyValue',
      'toNodeRelationships',
      'toNodeRelationships.relationshipType',
      'fromNodeRelationships',
      'fromNodeRelationships.relationshipType',
    ];

    const propertyKeyValueArray = prop.map(({ key, value }) => ({
      property_key: key,
      propertyValue: {
        property_value: JSON.stringify({ value }),
      },
    }));

    const nodes = await this.repository.find({
      relations: relationsArray,
      where: [
        {
          node_type: nodeType,
          propertyKeys: propertyKeyValueArray,
          toNodeRelationships: {
            relationshipType: In(relationshipTypes),
          },
        },
        {
          node_type: nodeType,
          propertyKeys: propertyKeyValueArray,
          fromNodeRelationships: {
            relationshipType: In(relationshipTypes),
          },
        },
      ],
    });

    return nodes.map(n => n.id);
  }

  async getNodeIdsByProps(
    type: string,
    props: { key: string; value: unknown }[],
  ): Promise<Nanoid[]> {
    const conditionStr = props
      .map(
        ({ key, value }) =>
          `(
              pk.property_key = \'${key}\' 
              and pv.property_value = \'${JSON.stringify({
                value: value,
              })}\'
            )`,
      )
      .join(' or ');

    const sqlStr = `
        select 
          nodes.node_id
        from 
          nodes 
          inner join (
            select 
              pk.node_property_key_id, 
              pk.node_id, 
              count(pk.property_key) as property_keys
            from 
              node_property_keys as pk 
              left join node_property_values as pv on pk.node_property_key_id = pv.node_property_key_id 
            where ${conditionStr}
            group by 
              pk.node_id 
            having 
              count(pk.property_key) = ${props.length}
          ) as npk on nodes.node_id = npk.node_id 
        where 
          nodes.node_type = \'${type}\';
      `;

    const nodes: [{ node_id: Nanoid }] = await this.repository.query(sqlStr);

    if (!nodes) {
      return [];
    }

    return nodes.map(({ node_id }) => node_id);
  }

  async getNodesByIds(
    ids: Array<string>,
    additionalRelations: Array<string> = [],
  ): Promise<Node[]> {
    return this.repository.find({
      where: { id: In(ids) },
      relations: [
        'propertyKeys',
        'propertyKeys.propertyValue',
        ...additionalRelations,
      ],
      select: {
        propertyKeys: {
          property_key: true,
          propertyValue: {
            property_value: true,
          },
        },
      },
    });
  }

  async getNodesByTypeAndRelatedNodes({
    type,
    from_node_id,
    to_node_id,
    onlyWithProps,
  }: getNodesByTypeAndRelatedNodesParams): Promise<Node[]> {
    try {
      const foundNodesQB = await this.repository
        .createQueryBuilder('node')
        .leftJoinAndSelect('node.propertyKeys', 'propertyKeys')
        .leftJoinAndSelect('propertyKeys.propertyValue', 'propertyValue')
        .leftJoinAndSelect('node.toNodeRelationships', 'toNodeRelationships')
        .leftJoinAndSelect(
          'node.fromNodeRelationships',
          'fromNodeRelationships',
        )
        .where('node.node_type = :type', { type });

      from_node_id &&
        foundNodesQB.andWhere(
          'fromNodeRelationships.from_node_id = :from_node_id',
          {
            from_node_id,
          },
        );

      to_node_id &&
        foundNodesQB.andWhere('toNodeRelationships.to_node_id = :to_node_id', {
          to_node_id,
        });
      
      if (onlyWithProps) {
        onlyWithProps.forEach(({ key, value }, i) => {
          const jsonValue = JSON.stringify({ value })
          foundNodesQB.andWhere(`propertyKeys.property_key = :key${i}`, {
            [`key${i}`]: key
          });
          foundNodesQB.andWhere(`propertyValue.property_value = :value${i}`, {
            [`value${i}`]: jsonValue
          });                  
        })
      }
      
      
      return foundNodesQB.getMany();
    } catch (err) {
      console.error(err);
      throw new Error(`Failed to get nodes by type ${type}`);
    }
  }

  async getNodePropertyValue(
    nodeId: Nanoid,
    propertyName: PropertyKeyConst,
  ): Promise<unknown> {
    const nodeEntity = await this.readNode(nodeId, [
      'propertyKeys',
      'propertyKeys.propertyValue',
    ]);

    if (!nodeEntity) {
      return null;
    }

    if (
      !nodeEntity.propertyKeys?.length ||
      nodeEntity.propertyKeys?.length < 1
    ) {
      return null;
    }

    const propertyIdx = nodeEntity.propertyKeys.findIndex(
      pk => pk.property_key === propertyName,
    );

    if (propertyIdx < 0) return null;

    const resJson =
      nodeEntity.propertyKeys[propertyIdx].propertyValue.property_value;
    const res = JSON.parse(resJson).value;

    return res;
  }
}
