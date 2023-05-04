import { LanguageDto } from './language.dto';
import { WordDto } from './word.dto';

export interface MapDto {
  id: string;
  name: string;
  ext: string;
  // map: string;
  mapFileId: string;
  langId: string;
  lang?: LanguageDto;
  words?: WordDto[];
  [key: string]: unknown;
}
