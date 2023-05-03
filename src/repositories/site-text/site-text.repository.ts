import { DbService } from '@/services/db.service';
import { SyncService } from '@/services/sync.service';

import { SiteText } from '@eten-lab/models';

export class SiteTextRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(SiteText);
  }

  async createOrFindSiteText(
    app_id: Nanoid,
    original_language_id: Nanoid,
    word_ref: Nanoid,
    definition_ref: Nanoid,
  ): Promise<SiteText> {
    // Checks an SiteText that already exists, and returns the SiteText if yes.
    const siteText = await this.repository.findOneBy({
      app_id,
      word_ref,
      definition_ref,
    });

    if (siteText) {
      return siteText;
    }

    const newSiteText = this.repository.create({
      app_id,
      word_ref,
      definition_ref,
      original_language_id,
      sync_layer: this.syncService.syncLayer,
    });

    return this.repository.save(newSiteText);
  }

  async getSiteTextById(siteTextId: Nanoid): Promise<SiteText | null> {
    return this.repository.findOneBy({ id: siteTextId });
  }

  async getSiteTextsByRef(
    app_id: Nanoid,
    word_ref: Nanoid,
  ): Promise<SiteText[]> {
    return this.repository.findBy({
      app_id,
      word_ref,
    });
  }

  async getSiteTextListByAppId(appId: Nanoid): Promise<SiteText[]> {
    return this.repository.findBy({
      app_id: appId,
    });
  }

  async changeSiteTextDefinition(
    id: Nanoid,
    definitionRef: Nanoid,
  ): Promise<void> {
    await this.repository.update(id, {
      definition_ref: definitionRef,
    });

    return;
  }

  async updateSiteTextWithNewSiteTextAndDefinition(
    id: Nanoid,
    wordRef: Nanoid,
    definitionRef: Nanoid,
  ): Promise<void> {
    await this.repository.update(id, {
      word_ref: wordRef,
      definition_ref: definitionRef,
    });

    return;
  }
}
