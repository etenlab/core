import { ElectionType } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

import { ElectionTypeConst } from '../../constants/voting.constant';

export class ElectionTypeRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(ElectionType);
  }

  async createOrFindElectionType(
    type_name: ElectionTypeConst,
  ): Promise<ElectionTypeConst> {
    const electionType = await this.repository.findOneBy({
      type_name: type_name,
    });

    if (electionType === null) {
      await this.repository.save({
        type_name: type_name,
        sync_layer: this.syncService.syncLayer,
      });
    }

    return type_name;
  }

  async listElectionTypes(): Promise<ElectionType[]> {
    const electionTypes = await this.repository.find({ select: ['type_name'] });

    return electionTypes;
  }
}
