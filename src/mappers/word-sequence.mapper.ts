import {
  WordSequenceDto,
  WordSequenceWithSubDto,
  SubSequenceDto,
} from '@/dtos/word-sequence.dto';
import { Node } from '@/models/index';
import {
  PropertyKeyConst,
  RelationshipTypeConst,
} from '@/constants/graph.constant';

export class WordSequenceMapper {
  static entityToDto(entity: Node) {
    const dto: WordSequenceDto = Object.create(null);
    dto.id = entity.id;

    entity.propertyKeys.forEach((key) => {
      switch (key.property_key) {
        case PropertyKeyConst.WORD_SEQUENCE: {
          dto.wordSequence = JSON.parse(key.propertyValue.property_value).value;

          return;
        }
        case PropertyKeyConst.DOCUMENT_ID: {
          dto.documentId = JSON.parse(key.propertyValue.property_value).value;

          return;
        }
        case PropertyKeyConst.CREATOR_ID: {
          dto.creatorId = JSON.parse(key.propertyValue.property_value).value;

          return;
        }
        case PropertyKeyConst.IMPORT_UID: {
          dto.importUid = JSON.parse(key.propertyValue.property_value).value;

          return;
        }
        case PropertyKeyConst.LANGUAGE_ID: {
          dto.languageId = JSON.parse(key.propertyValue.property_value).value;

          return;
        }
        case PropertyKeyConst.IS_ORIGIN: {
          dto.isOrigin = JSON.parse(key.propertyValue.property_value).value;

          return;
        }
        case PropertyKeyConst.ORIGINAL_WORD_SEQUENCE_ID: {
          dto.originalWordSequenceId = JSON.parse(
            key.propertyValue.property_value,
          ).value;

          return;
        }
      }
    });

    return dto;
  }

  static entityToDtoWithSubSequence(entity: Node) {
    const dto: WordSequenceWithSubDto = WordSequenceMapper.entityToDto(
      entity,
    ) as WordSequenceWithSubDto;

    dto.subSequences = [];

    if (!entity.toNodeRelationships) {
      return dto;
    }
    entity.toNodeRelationships.forEach((rel) => {
      if (
        rel.relationship_type !==
        RelationshipTypeConst.WORD_SEQUENCE_TO_SUB_WORD_SEQUENCE
      ) {
        return;
      }

      const subSequence: SubSequenceDto = Object.create(null);
      subSequence.id = rel.toNode.id;

      rel.propertyKeys.forEach((key) => {
        if (key.property_key === PropertyKeyConst.POSITION) {
          subSequence.position = JSON.parse(
            key.propertyValue.property_value,
          ).value;
        }
        if (key.property_key === PropertyKeyConst.LENGTH) {
          subSequence.len = JSON.parse(key.propertyValue.property_value).value;
        }
      });

      dto.subSequences.push(subSequence);
    });

    return dto;
  }
}
