import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';
import { Vote } from '@eten-lab/models';

export interface IVoteInput {
  ballot_entry_id: string;
  user_id: string;
  vote: boolean | null;
}

export class VoteRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(Vote);
  }

  async upsert(
    candidate_id: Nanoid,
    user_id: Nanoid,
    vote: boolean | null,
  ): Promise<void> {
    const voteEntity = await this.repository.findOneBy({
      candidate_id,
      user_id,
    });

    if (voteEntity) {
      if (vote === null) {
        return this.delete(voteEntity.id);
      }

      return this.update(voteEntity.id, vote);
    }

    if (vote === null) {
      return;
    }

    const newVote = this.repository.create({
      candidate_id,
      user_id,
      vote,
      sync_layer: this.syncService.syncLayer,
    });

    await this.repository.save(newVote);
  }

  async getVoteById(voteId: Nanoid): Promise<Vote | null> {
    return this.repository.findOne({
      where: { id: voteId },
    });
  }

  async getVoteByRef(
    candidate_id: Nanoid,
    user_id: Nanoid,
  ): Promise<Vote | null> {
    return this.repository.findOne({
      where: {
        candidate_id,
        user_id,
      },
    });
  }

  async listVotes(): Promise<Vote[]> {
    const votes = await this.repository.find();
    return votes;
  }

  async getVotesStats(candidateId: Nanoid): Promise<VotesStatsRow> {
    const result: VotesStatsRow[] = await this.repository.query(`
    SELECT 
      v.candidate_id as candidateId, 
      COUNT(
        CASE WHEN v.vote = true THEN 1 ELSE null END
      ) as upVotes, 
      COUNT(
        CASE WHEN v.vote = false THEN 1 ELSE null END
      ) as downVotes 
    FROM 
      votes AS v 
    WHERE 
      v.candidate_id = '${candidateId}'
    GROUP BY 
      v.candidate_id 
    ORDER BY 
      COUNT(
        CASE WHEN v.vote = true THEN 1 WHEN v.vote = false THEN 0 ELSE null END
      ) desc;`);

    if (result.length === 0) {
      return {
        candidateId,
        upVotes: 0,
        downVotes: 0,
      };
    }

    return result[0];
  }

  async update(voteId: Nanoid, vote: boolean): Promise<void> {
    const voteEntity = await this.repository.findOne({
      where: { id: voteId },
    });

    if (!voteEntity) {
      throw new Error(`Vote ${voteId} was not found`);
    }

    await this.repository.save({
      ...voteEntity,
      vote,
      sync_layer: this.syncService.syncLayer,
    });
  }

  async delete(voteId: Nanoid): Promise<void> {
    const vote = await this.getVoteById(voteId);

    if (!vote) {
      throw new Error(`Vote ${voteId} was not found`);
    }

    await this.repository.delete({ id: voteId });
  }
}
