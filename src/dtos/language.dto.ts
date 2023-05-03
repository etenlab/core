export interface LanguageDto {
  id: string;
  name: string;
}
export interface LanguageWithElecitonsDto {
  id: string;
  name: string;
  electionWordsId?: string;
  electionPhrasesId?: string;
}
