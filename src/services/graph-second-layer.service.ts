import { GraphFirstLayerService } from './graph-first-layer.service';

import { Node, Relationship } from '@eten-lab/models';
import { PropertyKeyConst } from '../constants/graph.constant';
import { LoggerService } from './logger.service';
const logger = new LoggerService()

export class GraphSecondLayerService {
  constructor(private readonly firstLayerService: GraphFirstLayerService) {}

  async createNodeFromObject(type_name: string, obj: object): Promise<Node> {
    const node = await this.firstLayerService.createNode(type_name);

    for (const [key, value] of Object.entries(obj)) {
      const property_key_id = await this.firstLayerService.createNodePropertyKey(
        node.id,
        key,
      );

      await this.firstLayerService.setNodePropertyValue(property_key_id, value);
    }

    return node;
  }

  async createNodesFromObjects(type_name: string, objects: Array<any>): Promise<Array<Nanoid>> {

    const nodeIds = await this.firstLayerService.createNodes(type_name, objects.length);
    const nodePromises = [];
    for (let i = 0; i < nodeIds.length; i++) {
      nodePromises.push( this.addNewNodePropertiesNoChecks(nodeIds[i],objects[i]))
    }
    await Promise.all(nodePromises)

    return nodeIds;
  }

  async createRelationshipFromObject(
    type_name: string,
    obj: object,
    from_node: Nanoid,
    to_node: Nanoid,
  ): Promise<Relationship> {
    const relationship = await this.firstLayerService.createRelationship(
      from_node,
      to_node,
      type_name,
    );

    for (const [key, value] of Object.entries(obj)) {
      const property_key_id = await this.firstLayerService.getRelationshipPropertyKey(
        relationship.id,
        key,
      );

      await this.firstLayerService.setRelationshipPropertyValue(
        property_key_id,
        value,
      );
    }

    return relationship;
  }

  async createRelatedFromNodeFromObject(
    rel_type_name: string,
    rel_obj: object,
    node_type_name: string,
    obj: object,
    to_node_id: Nanoid,
  ): Promise<{
    relationship: Relationship;
    node: Node;
  }> {
    const from_node = await this.createNodeFromObject(node_type_name, obj);
    const relationship = await this.createRelationshipFromObject(
      rel_type_name,
      rel_obj,
      from_node.id,
      to_node_id,
    );

    return {
      relationship,
      node: from_node,
    };
  }

  async createRelatedToNodeFromObject(
    rel_type_name: string,
    rel_obj: object,
    from_node_id: Nanoid,
    node_type_name: string,
    obj: object,
  ): Promise<{
    relationship: Relationship;
    node: Node;
  }> {
    const to_node = await this.createNodeFromObject(node_type_name, obj);
    const relationship = await this.createRelationshipFromObject(
      rel_type_name,
      rel_obj,
      from_node_id,
      to_node.id,
    );

    return {
      relationship,
      node: to_node,
    };
  }

  /**
   * This function adds a new node property to the given object.
   * Be careful, if the object property already exists in the node, an error will be thrown.
   */
  async addNewNodeProperties(node_id: Nanoid, obj: object): Promise<Node> {
    // TODO: looks like checks on node existance are duplicated gere an in property addition. Can be optimized.
    const node = await this.firstLayerService.readNode(node_id);

    if (node === null) {
      throw new Error(`Not Exists node with #node_id='${node_id}'`);
    }

    for (const [key] of Object.entries(obj)) {
      const property_value = await this.firstLayerService.getNodePropertyValue(
        node.id,
        key as PropertyKeyConst,
      );

      if (property_value !== null) {
        throw new Error(
          `Already exists #node_property_key=${key} at current node`,
        );
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      let property_key_id = await this.firstLayerService.findNodePropertyKey(
        node.id,
        key,
      );

      if (!property_key_id) {
        property_key_id = await this.firstLayerService.createNodePropertyKey(
          node.id,
          key,
        );
      }

      await this.firstLayerService.createNodePropertyValue(
        property_key_id,
        value,
      );
    }

    return node;
  }

  /**
   * This function adds a new node property to the given object.
   * Be careful, if the object property already exists in the node, another one will be created
   */
  async addNewNodePropertiesNoChecks(node_id: Nanoid, obj: object): Promise<void> {

    for (const [key, value] of Object.entries(obj)) {
      const time100 = performance.now()
      
      const property_key_id = await this.firstLayerService.createNodePropertyKeyNoChecks(
        node_id,
        key,
      );
      const time200 = performance.now()
      logger.trace({time200},' time200 - time100: ', time200 - time100 )

      await this.firstLayerService.createNodePropertyValue(
        property_key_id,
        value,
      );
      const time300 = performance.now()
      logger.trace({time300},' time300 - time200: ', time300 - time200 )
      
    }

  }

  /**
   * This function adds a new node property to the given object.
   * Be careful, if the object property already exists in the node, an error will be thrown.
   */
  async addNewRelationshipProperties(
    rel_id: Nanoid,
    obj: object,
  ): Promise<Relationship> {
    const rel = await this.firstLayerService.readRelationship(rel_id);

    if (rel === null) {
      throw new Error(`Not Exists relationship with #rel_id='${rel_id}'`);
    }

    for (const [key] of Object.entries(obj)) {
      const property_value = await this.firstLayerService.getRelationshipPropertyValue(
        rel.id,
        key as PropertyKeyConst,
      );

      if (property_value !== null) {
        throw new Error(
          `Already exists #relationsihp_property_key=${key} at current node`,
        );
      }
    }

    for (const [key, value] of Object.entries(obj)) {
      let property_key_id = await this.firstLayerService.findNodePropertyKey(
        rel.id,
        key,
      );

      if (!property_key_id) {
        property_key_id = await this.firstLayerService.createNodePropertyKey(
          rel.id,
          key,
        );
      }

      await this.firstLayerService.createNodePropertyValue(
        property_key_id,
        value,
      );
    }

    return rel;
  }

  /**
   * @deprecated
   * Never use it, and remove you used.
   * Use addNewNodeProperties function
   */
  async updateNodeObject(node_id: Nanoid, obj: object): Promise<Node> {
    const node = await this.firstLayerService.readNode(node_id);

    if (node === null) {
      throw new Error(`Not Exists node with #node_id='${node_id}'`);
    }

    for (const [key, value] of Object.entries(obj)) {
      const property_key_id = await this.firstLayerService.getNodePropertyKey(
        node.id,
        key,
      );

      await this.firstLayerService.setNodePropertyValue(property_key_id, value);
    }

    return node;
  }

  /**
   * @deprecated
   * Never use it, and remove you used.
   * Use addNewRelationshipProperties function.
   */
  async updateRelationshipObject(
    rel_id: Nanoid,
    obj: object,
  ): Promise<Relationship> {
    const rel = await this.firstLayerService.readRelationship(rel_id);

    if (rel === null) {
      throw new Error(`Not Exists relationship with #rel_id='${rel_id}'`);
    }

    for (const [key, value] of Object.entries(obj)) {
      const property_key_id = await this.firstLayerService.getRelationshipPropertyKey(
        rel.id,
        key,
      );

      await this.firstLayerService.setRelationshipPropertyValue(
        property_key_id,
        value,
      );
    }

    return rel;
  }
}
