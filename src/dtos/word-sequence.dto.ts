export interface WordSequenceDto {
  id: string;
  wordSequence: string;
  documentId: Nanoid;
  creatorId: Nanoid;
  importUid: string;
  languageId: Nanoid;
  isOrigin: boolean;
  originalWordSequenceId?: Nanoid;
}

export type SubSequenceDto = {
  id: Nanoid;
  position: number;
  len: number;
};

export interface WordSequenceWithSubDto extends WordSequenceDto {
  subSequences: SubSequenceDto[];
}

export interface WordSequenceWithVote extends WordSequenceDto {
  vote: VotesStatsRow;
}
