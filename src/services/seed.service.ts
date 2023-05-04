import { NodePropertyKeyRepository } from '../repositories/node/node-property-key.repository';
import { NodePropertyValueRepository } from '../repositories/node/node-property-value.repository';
import { NodeTypeRepository } from '../repositories/node/node-type.repository';
import { NodeRepository } from '../repositories/node/node.repository';
import { RelationshipPropertyKeyRepository } from '../repositories/relationship/relationship-property-key.repository';
import { RelationshipPropertyValueRepository } from '../repositories/relationship/relationship-property-value.repository';
import { RelationshipTypeRepository } from '../repositories/relationship/relationship-type.repository';
import { RelationshipRepository } from '../repositories/relationship/relationship.repository';
import tags from 'language-tags';

type Lang = {
  tag: string;
  descriptions: Array<string>;
};
type Dialect = {
  tag: string | null;
  descriptions: Array<string>;
};
type Region = {
  tag: string | null;
  descriptions: Array<string>;
};

enum TagTypes {
  LANGUAGE = 'language',
  REGION = 'region',
  DIALECT = 'variant',
}
enum TagSpecialDescriptions {
  PRIVATE_USE = 'Private use',
}

const DATA_SEEDED = 'DATA_SEEDED';
export class SeedService {
  private get dataSeeded() {
    return localStorage.getItem(DATA_SEEDED) === 'true';
  }
  private set dataSeeded(val: boolean) {
    localStorage.setItem(DATA_SEEDED, val + '');
  }

  constructor(
    private readonly nodeRepository: NodeRepository,
    private readonly nodeTypeRepository: NodeTypeRepository,
    private readonly nodePropertyKeyRepository: NodePropertyKeyRepository,
    private readonly nodePropertyValueRepository: NodePropertyValueRepository,
    private readonly relationshipRepository: RelationshipRepository,
    private readonly relationshipTypeRepository: RelationshipTypeRepository,
    private readonly relationshipPropertyKeyRepository: RelationshipPropertyKeyRepository,
    private readonly relationshipPropertyValueRepository: RelationshipPropertyValueRepository,
  ) {
    this.init();
  }

  async init() {
    try {
      if (this.dataSeeded) return;
      console.log('*** data seeding started ***');
      await Promise.allSettled([this.seedLanguages()]);
      console.log('*** data seeding completed ***');
      this.dataSeeded = true;
    } catch (error) {
      console.log('seeding failed::', error);
    }
  }

  async createNodesAndRelationship() {
    // random string of length 10
    const nodeType1 = await this.nodeTypeRepository.createNodeType(
      Math.random().toString(36).substring(2, 10),
    );
    const nodeType2 = await this.nodeTypeRepository.createNodeType(
      Math.random().toString(36).substring(2, 10),
    );
    const node1 = await this.nodeRepository.createNode(nodeType1);
    const node2 = await this.nodeRepository.createNode(nodeType2);

    const relationshipType =
      await this.relationshipTypeRepository.createRelationshipType(
        Math.random().toString(36).substring(2, 10),
      );

    const relationship = await this.relationshipRepository.createRelationship(
      node1.id,
      node2.id,
      relationshipType,
    );

    const nodePropKey = await this.nodePropertyKeyRepository.getNodePropertyKey(
      node1.id,
      Math.random().toString(36).substring(2, 10),
    );

    await this.nodePropertyValueRepository.setNodePropertyValue(
      nodePropKey,
      Math.random().toString(36).substring(2, 10),
    );

    const relationshipPropKey =
      await this.relationshipPropertyKeyRepository.getRelationshipPropertyKey(
        relationship!.id,
        Math.random().toString(36).substring(2, 10),
      );

    await this.relationshipPropertyValueRepository.setRelationshipPropertyValue(
      relationshipPropKey!,
      Math.random().toString(36).substring(2, 10),
    );
  }

  async seedLanguages(langs?: string[]) {
    try {
      const langNodes = await this.nodeRepository.repository.find({
        relations: ['propertyKeys', 'propertyKeys.propertyValue'],
        where: {
          node_type: 'language',
        },
      });

      if (langNodes.length) return;

      let langList = langs && langs.length > 0 ? langs : [];
      if (!langList.length) {
        langList = randomLangTags(10);
      }

      for (const lang of langList) {
        const langNode = await this.nodeRepository.createNode('language');
        for (const [key, value] of Object.entries({ name: lang })) {
          const property_key_id =
            await this.nodePropertyKeyRepository.getNodePropertyKey(
              langNode.id,
              key,
            );
          if (property_key_id) {
            await this.nodePropertyValueRepository.setNodePropertyValue(
              property_key_id,
              value,
            );
          }
        }
      }
    } catch (error) {
      console.error('failed to seed languages::', error);
      throw new Error('failed to seed languages');
    }
  }
}

const randomLangTags = (amount: number): Array<string> => {
  const allTags = tags.search(/.*/);
  const langs: Array<Lang> = [];
  const dialects: Array<Dialect> = [
    { tag: null, descriptions: ['- not defined-'] },
  ];
  const regions: Array<Region> = [
    { tag: null, descriptions: ['- not defined-'] },
  ];

  for (const currTag of allTags) {
    if (
      currTag.deprecated() ||
      currTag.descriptions().includes(TagSpecialDescriptions.PRIVATE_USE)
    ) {
      continue;
    }

    if (currTag.type() === TagTypes.LANGUAGE) {
      langs.push({
        tag: currTag.format(),
        descriptions: currTag.descriptions(),
      });
    }
    if (currTag.type() === TagTypes.REGION) {
      regions.push({
        tag: currTag.format(),
        descriptions: currTag.descriptions(),
      });
    }
    if (currTag.type() === TagTypes.DIALECT) {
      dialects.push({
        tag: currTag.format(),
        descriptions: currTag.descriptions(),
      });
    }
  }
  const langTagsList: Array<string> = [];
  for (let index = 0; index < amount; index++) {
    const li = Math.floor(Math.random() * langs.length);
    const ri = Math.floor(Math.random() * regions.length);
    const di = Math.floor(Math.random() * dialects.length);

    const tag = `${langs[li].tag}-${regions[ri].tag}-${dialects[di].tag}`;
    const isValid = tags(tag).valid();
    if (!isValid) {
      throw new Error(
        `language seeding error: generated tag ${tag} is not valid`,
      );
    }

    langTagsList.push(tag);
  }

  return langTagsList;
};
