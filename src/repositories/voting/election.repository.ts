import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

import { Election, ElectionType } from '@eten-lab/models';

import { ElectionTypeConst } from '../../constants/voting.constant';

export class ElectionRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(Election);
  }

  async createOrFindElection(
    election_type: ElectionTypeConst,
    election_ref: Nanoid,
    ref_table_name: string,
    candidate_ref_table_name: string,
    options?: {
      appId?: Nanoid;
      siteText?: boolean;
      siteTextTranslation?: boolean;
    },
  ): Promise<Election> {
    const electionType = await this.dbService.dataSource
      .getRepository(ElectionType)
      .findOneBy({ type_name: election_type });

    if (electionType === null) {
      await this.dbService.dataSource
        .getRepository(ElectionType)
        .save({
          type_name: election_type,
          sync_layer: this.syncService.syncLayer,
        });
    }

    // Checks an Election that already exists, and returns the Election if yes.
    // const election = await this.repository.findOneBy({
    //   election_type,
    //   election_ref,
    //   ref_table_name,
    // });

    const election = await this.getElectionByRef(
      election_type,
      election_ref,
      ref_table_name,
      options,
    );

    if (election) {
      return election;
    }

    const newElection = this.repository.create({
      election_type,
      election_ref,
      ref_table_name,
      candidate_ref_table_name,
      app: options?.appId,
      site_text: options?.siteText,
      site_text_translation: options?.siteTextTranslation,
      sync_layer: this.syncService.syncLayer,
    });

    return this.repository.save(newElection);
  }

  async getElectionById(electionId: Nanoid): Promise<Election | null> {
    return this.repository.findOneBy({ id: electionId });
  }

  async getElectionByRef(
    election_type: ElectionTypeConst,
    election_ref: Nanoid,
    ref_table_name: string,
    options?: {
      appId?: Nanoid;
      siteText?: boolean;
      siteTextTranslation?: boolean;
    },
  ): Promise<Election | null> {
    return this.repository.findOneBy({
      election_type,
      election_ref,
      ref_table_name,
      app: options?.appId,
      site_text: options?.siteText,
      site_text_translation: options?.siteTextTranslation,
    });
  }

  async getSiteTextElectionList({
    appId,
    siteText,
    siteTextTranslation,
  }: {
    appId: string;
    siteText?: boolean;
    siteTextTranslation?: boolean;
  }): Promise<Election[]> {
    const elections = await this.repository.find({
      where: {
        app: appId,
        site_text: siteText,
        site_text_translation: siteTextTranslation,
      },
    });

    return elections;
  }
}
