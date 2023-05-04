import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

import { Candidate } from '@eten-lab/models';

export class CandidateRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(Candidate);
  }

  async createCandidate(
    election_id: Nanoid,
    candidate_ref: Nanoid,
  ): Promise<Candidate> {
    // Checks an Candidate that already exists, and returns the Candidate if yes.
    const candidate = await this.repository.findOneBy({
      election_id,
      candidate_ref,
    });

    if (candidate) {
      return candidate;
    }

    const newCandidate = this.repository.create({
      election_id,
      candidate_ref,
      sync_layer: this.syncService.syncLayer,
    });

    return this.repository.save(newCandidate);
  }

  async getCandidateById(candidateId: Nanoid): Promise<Candidate | null> {
    return this.repository.findOneBy({ id: candidateId });
  }

  async getCandidateByRef(
    election_id: Nanoid,
    candidate_ref: Nanoid,
  ): Promise<Candidate | null> {
    return this.repository.findOneBy({
      election_id,
      candidate_ref,
    });
  }
}
