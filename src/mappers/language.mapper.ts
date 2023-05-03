import { LanguageDto } from '@/dtos/language.dto';
import { Node } from '@/models/index';

export class LanguageMapper {
  static entityToDto(entity: Node) {
    const dto: LanguageDto = Object.create(null);

    dto.id = entity.id;

    for (const propertyKey of entity.propertyKeys) {
      dto[propertyKey.property_key as keyof LanguageDto] = JSON.parse(
        propertyKey.propertyValue?.property_value,
      ).value;
    }

    return dto;
  }
}
