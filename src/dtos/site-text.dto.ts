export interface Votable {
  upVotes: number;
  downVotes: number;
  candidateId: Nanoid;
}

export interface SiteTextTranslationDto {
  id: Nanoid;
  siteTextId: Nanoid;
  languageId: Nanoid;
  translatedSiteText: string;
  translatedDefinition: string;
}

export type TranslationType = 'origin' | 'selected' | 'recommended';

export interface SiteTextDto {
  id: Nanoid;
  appId: Nanoid;
  languageId: Nanoid;
  siteText: string;
  definition: string;
  translated: {
    siteText: string;
    definition: string;
    type: TranslationType;
  } | null;
}

export interface SiteTextWithTranslationCntDto extends SiteTextDto {
  translationCnt: number;
}

export interface SiteTextTranslationVotable extends Votable {
  id: Nanoid;
  siteTextId: Nanoid;
  languageId: Nanoid;
  translatedSiteText: string;
  translatedDefinition: string;
}

export interface SiteTextWithTranslationVotablesDto extends SiteTextDto {
  translations: SiteTextTranslationVotable[];
  electionId: Nanoid;
}
