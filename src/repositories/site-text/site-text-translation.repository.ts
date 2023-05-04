import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

import { SiteTextTranslation } from '@eten-lab/models';

export class SiteTextTranslationRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  get repository() {
    return this.dbService.dataSource.getRepository(SiteTextTranslation);
  }

  async createOrFindSiteTextTranslation(
    site_text_id: Nanoid,
    language_id: Nanoid,
    word_ref: Nanoid,
    definition_ref: Nanoid,
  ): Promise<SiteTextTranslation> {
    // Checks an SiteText that already exists, and returns the SiteText if yes.
    const siteTextTranslation = await this.repository.findOneBy({
      site_text_id,
      language_id,
      word_ref,
      definition_ref,
    });

    if (siteTextTranslation) {
      return siteTextTranslation;
    }

    const newSiteTextTranslation = this.repository.create({
      site_text_id,
      word_ref,
      definition_ref,
      language_id,
      sync_layer: this.syncService.syncLayer,
    });

    return this.repository.save(newSiteTextTranslation);
  }

  async updateSiteTextTranslation(
    siteTextTranslationId: Nanoid,
    wordRef: Nanoid,
    definitionRef: Nanoid,
  ) {
    return this.repository.update(siteTextTranslationId, {
      word_ref: wordRef,
      definition_ref: definitionRef,
    });
  }

  async deleteSiteTextTranslationById(siteTextTranslationId: Nanoid) {
    return this.repository.delete(siteTextTranslationId);
  }

  async getSiteTextTranslationById(
    siteTextTranslationId: Nanoid,
  ): Promise<SiteTextTranslation | null> {
    return this.repository.findOneBy({ id: siteTextTranslationId });
  }

  async getSiteTextTranslationByRef(
    siteTextId: Nanoid,
    langId: Nanoid,
  ): Promise<SiteTextTranslation | null> {
    return this.repository.findOneBy({
      site_text_id: siteTextId,
      language_id: langId,
    });
  }

  async getSiteTextTranslationList(
    siteTextId: Nanoid,
    languageId: Nanoid,
  ): Promise<SiteTextTranslation[]> {
    return this.repository.findBy({
      site_text_id: siteTextId,
      language_id: languageId,
    });
  }

  async getSelectedSiteTextTranslation(
    siteTextId: Nanoid,
    langId: Nanoid,
  ): Promise<SiteTextTranslation | null> {
    return this.repository.findOne({
      where: {
        site_text_id: siteTextId,
        language_id: langId,
        is_selected: true,
      },
    });
  }

  async changeSiteTextTranslationDefinition(
    id: Nanoid,
    definitionRef: Nanoid,
  ): Promise<void> {
    await this.repository.update(id, {
      definition_ref: definitionRef,
    });

    return;
  }

  async selectSiteTextTranslation(
    id: Nanoid,
    siteTextId: Nanoid,
  ): Promise<void> {
    const siteTextTranslation = await this.getSiteTextTranslationById(id);

    if (!siteTextTranslation) {
      return;
    }

    await this.cancelSiteTextTranslation(
      siteTextId,
      siteTextTranslation.language_id,
    );

    this.repository.update(id, {
      is_selected: true,
    });
  }

  async cancelSiteTextTranslation(
    siteTextId: Nanoid,
    langId: Nanoid,
  ): Promise<void> {
    const selected = await this.getSelectedSiteTextTranslation(
      siteTextId,
      langId,
    );

    if (!selected) {
      return;
    }

    this.repository.update(selected.id, {
      is_selected: false,
    });
  }
}
