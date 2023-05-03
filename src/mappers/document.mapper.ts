import { DocumentDto } from '@/dtos/document.dto';
import { Node } from '@/models/index';

export class DocumentMapper {
  static entityToDto(entity: Node) {
    const dto: DocumentDto = Object.create(null);

    dto.id = entity.id;

    for (const propertyKey of entity.propertyKeys) {
      dto[propertyKey.property_key as keyof DocumentDto] = JSON.parse(
        propertyKey.propertyValue?.property_value,
      ).value;
    }

    return dto;
  }
}
