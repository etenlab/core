import { WordDto } from '../dtos/word.dto';
import { Node } from '../models';

export class WordMapper {
  static entityToDto(node: Node) {
    const dto: WordDto = Object.create(null);
    dto.id = node.id;
    for (const pk of node.propertyKeys) {
      dto[pk.property_key] = undefined;
      if (pk.propertyValue && pk.propertyValue.property_value) {
        dto[pk.property_key] = JSON.parse(
          pk.propertyValue.property_value,
        ).value;
      }
    }
    // for (const relNode of node.toNodeRelationships) {
    // }
    return dto;
  }
}
