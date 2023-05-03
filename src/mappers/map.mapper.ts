import { MapDto } from '../dtos/map.dto';
import { Node } from '@/src/models';

export class MapMapper {
  static entityToDto(entity: Node) {
    const dto: MapDto = Object.create(null);
    dto.id = entity.id;
    for (const propertyKey of entity.propertyKeys) {
      dto[propertyKey.property_key] = JSON.parse(
        propertyKey.propertyValue?.property_value,
      ).value;
    }
    dto.langId = entity.toNodeRelationships?.at(0)?.to_node_id as string;
    return dto;
  }
}
