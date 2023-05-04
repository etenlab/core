import { FindOptionsWhere } from 'typeorm';

import { NodePropertyKeyRepository } from '../repositories/node/node-property-key.repository';
import { NodePropertyValueRepository } from '../repositories/node/node-property-value.repository';
import { NodeRepository } from '../repositories/node/node.repository';
import { NodeTypeRepository } from '../repositories/node/node-type.repository';

import { RelationshipPropertyKeyRepository } from '../repositories/relationship/relationship-property-key.repository';
import { RelationshipPropertyValueRepository } from '../repositories/relationship/relationship-property-value.repository';
import { RelationshipRepository } from '../repositories/relationship/relationship.repository';
import { RelationshipTypeRepository } from '../repositories/relationship/relationship-type.repository';

import {
  Node,
  NodeType,
  Relationship,
  RelationshipType,
} from '@eten-lab/models';
import { NodeTypeConst, PropertyKeyConst } from '../constants/graph.constant';

export class GraphFirstLayerService {
  constructor(
    private readonly nodeTypeRepo: NodeTypeRepository,
    private readonly nodeRepo: NodeRepository,
    private readonly nodePropertyKeyRepo: NodePropertyKeyRepository,
    private readonly nodePropertyValueRepo: NodePropertyValueRepository,

    private readonly relationshipTypeRepo: RelationshipTypeRepository,
    private readonly relationshipRepo: RelationshipRepository,
    private readonly relationshipPropertyKeyRepo: RelationshipPropertyKeyRepository,
    private readonly relationshipPropertyValueRepo: RelationshipPropertyValueRepository,
  ) {}

  // node type
  async createNodeType(type_name: string): Promise<string> {
    return this.nodeTypeRepo.createNodeType(type_name);
  }

  async listNodeTypes(): Promise<NodeType[]> {
    return this.nodeTypeRepo.listNodeTypes();
  }

  // node
  async listAllNodesByType(type_name: string): Promise<Node[]> {
    return this.nodeRepo.listAllNodesByType(type_name);
  }

  async createNode(type_name: string): Promise<Node> {
    return this.nodeRepo.createNode(type_name);
  }

  async readNode(
    node_id: Nanoid,
    relations?: string[],
    whereObj?: FindOptionsWhere<Node>,
  ): Promise<Node | null> {
    return this.nodeRepo.readNode(node_id, relations, whereObj);
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
    return this.nodeRepo.getNodeByProp(type, prop, relationship);
  }

  async getNodesByProps(
    type: string,
    props: { key: string; value: unknown }[],
  ): Promise<Nanoid[]> {
    return this.nodeRepo.getNodesByProps(type, props);
  }

  // node-property-key
  async getNodePropertyKey(node_id: Nanoid, key_name: string): Promise<Nanoid> {
    return this.nodePropertyKeyRepo.getNodePropertyKey(node_id, key_name);
  }

  async getNodePropertyValue(
    nodeId: Nanoid,
    propertyName: PropertyKeyConst,
  ): Promise<unknown> {
    return this.nodeRepo.getNodePropertyValue(nodeId, propertyName);
  }

  // node-property-value
  async setNodePropertyValue(
    key_id: Nanoid,
    key_value: unknown,
  ): Promise<Nanoid> {
    return this.nodePropertyValueRepo.setNodePropertyValue(key_id, key_value);
  }

  // relationship type
  async createRelationshipType(type_name: string): Promise<string> {
    return this.relationshipTypeRepo.createRelationshipType(type_name);
  }

  async listRelationshipTypes(): Promise<RelationshipType[]> {
    return this.relationshipTypeRepo.listRelationshipTypes();
  }

  // relationship
  async createRelationship(
    from_node_id: Nanoid,
    to_node_id: Nanoid,
    type_name: string,
  ): Promise<Relationship> {
    return this.relationshipRepo.createRelationship(
      from_node_id,
      to_node_id,
      type_name,
    );
  }

  async findRelationship(
    node_1: Nanoid,
    node_2: Nanoid,
    type_name: string,
  ): Promise<Relationship | null> {
    return this.relationshipRepo.findRelationship(node_1, node_2, type_name);
  }

  async listAllRelationshipsByType(type_name: string): Promise<Relationship[]> {
    return this.relationshipRepo.listAllRelationshipsByType(type_name);
  }

  async readRelationship(rel_id: Nanoid): Promise<Relationship | null> {
    return this.relationshipRepo.readRelationship(rel_id);
  }

  // async listRelatedNodes(node_id: string): Promise<any> {
  //   return this.relationshipRepo.listRelatedNodes(node_id);
  // }

  // relationship property key
  async getRelationshipPropertyKey(
    rel_id: Nanoid,
    key_name: string,
  ): Promise<Nanoid> {
    return this.relationshipPropertyKeyRepo.getRelationshipPropertyKey(
      rel_id,
      key_name,
    );
  }

  // relationship property value
  async setRelationshipPropertyValue(
    key_id: Nanoid,
    key_value: unknown,
  ): Promise<Nanoid> {
    return this.relationshipPropertyValueRepo.setRelationshipPropertyValue(
      key_id,
      key_value,
    );
  }

  async getNodesByTypeAndRelatedNodes({
    type,
    from_node_id,
    to_node_id,
  }: getNodesByTypeAndRelatedNodesParams): Promise<Node[]> {
    try {
      const foundNodesQB = await this.nodeRepo.repository
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
      return foundNodesQB.getMany();
    } catch (err) {
      console.error(err);
      throw new Error(`Failed to get nodes by type ${type}`);
    }
  }
}

interface getNodesByTypeAndRelatedNodesParams {
  type: NodeTypeConst;
  from_node_id?: Nanoid;
  to_node_id?: Nanoid;
}
