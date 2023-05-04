import { ElectionRepository } from '../repositories/voting/election.repository';
import { CandidateRepository } from '../repositories/voting/candidate.repository';
import { VoteRepository } from '../repositories/voting/vote.repository';

import { Candidate, Election, Vote } from '@eten-lab/models';

import { ElectionTypeConst } from '../constants/voting.constant';

export class VotingService {
  constructor(
    private readonly electionRepo: ElectionRepository,
    private readonly candidateRepo: CandidateRepository,
    private readonly voteRepo: VoteRepository,
  ) {}

  async createElection(
    election_type: ElectionTypeConst,
    election_ref: Nanoid,
    ref_table_name: string,
    candidate_ref_table_name: string,
  ): Promise<Election> {
    return this.electionRepo.createElection(
      election_type,
      election_ref,
      ref_table_name,
      candidate_ref_table_name,
    );
  }

  async getElectionById(electionId: Nanoid): Promise<Election | null> {
    return this.electionRepo.getElectionById(electionId);
  }

  async getElectionByRef(
    election_type: ElectionTypeConst,
    election_ref: Nanoid,
    ref_table_name: string,
  ): Promise<Election | null> {
    return this.electionRepo.getElectionByRef(
      election_type,
      election_ref,
      ref_table_name,
    );
  }

  async getElectionFull(electionId: Nanoid): Promise<VotesStatsRow[]> {
    const election = await this.electionRepo.getElectionById(electionId);

    if (!election) {
      throw new Error('Not Exists a Election by Eleciton Id!');
    }

    const candidateWithStatesList = [];

    for (const candidate of election.candidates) {
      const tmp = await this.voteRepo.getVotesStats(candidate.id);
      candidateWithStatesList.push(tmp);
    }

    return candidateWithStatesList;
  }

  async addCandidate(
    electionId: Nanoid,
    candidateRef: Nanoid,
  ): Promise<Candidate> {
    return this.candidateRepo.createCandidate(electionId, candidateRef);
  }

  async getCandidateById(candidateId: Nanoid): Promise<Candidate | null> {
    return this.candidateRepo.getCandidateById(candidateId);
  }

  async getCandidateByRef(
    electionId: Nanoid,
    candidateRef: Nanoid,
  ): Promise<Candidate | null> {
    return this.candidateRepo.getCandidateByRef(electionId, candidateRef);
  }

  async getVotesStats(candidateId: Nanoid): Promise<VotesStatsRow> {
    return this.voteRepo.getVotesStats(candidateId);
  }

  async addVote(
    candidateId: Nanoid,
    userId: Nanoid,
    vote: boolean | null,
  ): Promise<void> {
    await this.voteRepo.upsert(candidateId, userId, vote);
  }

  async getVoteByRef(
    candidateId: Nanoid,
    userId: Nanoid,
  ): Promise<Vote | null> {
    return this.voteRepo.getVoteByRef(candidateId, userId);
  }
}
