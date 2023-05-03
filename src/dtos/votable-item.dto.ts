export interface Votable {
  upVotes: number;
  downVotes: number;
  candidateId: Nanoid | null;
}

export interface VotableContent extends Votable {
  id: Nanoid | null;
  content: string;
}

export interface VotableItem {
  title: VotableContent;
  contents: VotableContent[];
  contentElectionId: Nanoid | null;
}
