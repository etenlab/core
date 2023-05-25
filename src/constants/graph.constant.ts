export enum NodeTypeConst {
  TABLE = 'table',
  TABLE_COLUMN = 'table-column',
  TABLE_ROW = 'table-row',
  TABLE_CELL = 'table-cell',
  TABLE_CELL_PSEUDO = 'table-cell-pseudo',

  ELECTION = 'election',
  BALLOT_ENTRY = 'ballot-entry',

  LEXICON = 'lexicon',
  LEXICAL_CATEGORY = 'lexical_category',
  GRAMATICAL_CATEGORY = 'grammatical_category',
  GRAMMEME = 'grammeme',
  LEXEME = 'lexeme',
  WORD_FORM = 'word_form',

  DOCUMENT = 'document',

  MAP = 'map',
  WORD = 'word',
  WORD_SEQUENCE = 'word-sequence',
  /**
   * @deprecated
   */
  MOCK_APP = 'mock-app',

  USER = 'user',
  DEFINITION = 'definition',
  PHRASE = 'phrase',
}

export enum RelationshipTypeConst {
  TABLE_TO_COLUMN = 'table-to-column',
  TABLE_TO_ROW = 'table-to-row',
  TABLE_COLUMN_TO_CELL = 'table-column-to-cell',
  TABLE_ROW_TO_CELL = 'table-row-to-cell',

  WORD_MAP = 'word-map',
  WORD_TO_TRANSLATION = 'word-to-translation',

  WORD_SEQUENCE_TO_WORD = 'word-sequence-to-word',
  WORD_SEQUENCE_TO_DOCUMENT = 'word-sequence-to-document',
  WORD_SEQUENCE_TO_CREATOR = 'word-sequence-to-creator',
  WORD_SEQUENCE_TO_WORD_SEQUENCE = 'word-sequence-to-word-sequence',
  WORD_SEQUENCE_TO_TRANSLATION = 'word-sequence-to-translation',
  WORD_SEQUENCE_TO_SUB_WORD_SEQUENCE = 'word-sequence-to-sub-word-sequence',

  WORD_TO_DEFINITION = 'word-to-definition',
  PHRASE_TO_DEFINITION = 'phrase-to-definition',
}

export enum PropertyKeyConst {
  NAME = 'name',
  EMAIL = 'email',

  TABLE_NAME = 'table_name',
  ROW_ID = 'row_id',
  ELECTION_ID = 'election_id',
  ELECTION_TYPE = 'election-type',

  IMPORT_UID = 'import-uid',
  WORD_SEQUENCE = 'word_sequence',

  IS_ORIGIN = 'is_origin',
  CREATOR_ID = 'creator_id',
  DOCUMENT_ID = 'document_id',
  POSITION = 'position',
  LENGTH = 'length',

  ORIGINAL_WORD_SEQUENCE_ID = 'original-word-sequence-id',
  DEFINITION = 'definition',

  SITE_TEXT = 'site-text',
  WORD = 'word',
  PHRASE = 'phrase',

  LANGUAGE_TAG = 'language',
  DIALECT_TAG = 'dialect',
  REGION_TAG = 'region',
}

export const MainKeyName = {
  [NodeTypeConst.WORD]: PropertyKeyConst.WORD,
  [NodeTypeConst.PHRASE]: PropertyKeyConst.PHRASE,
};
