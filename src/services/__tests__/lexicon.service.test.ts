import { getTestDataSource } from '../../data-source';
import getSingletons from '../../singletons';
import { BaseType, CRUDService } from '../crud-service';
import { LexiconService } from '../lexicon.service';

describe('LexiconService', () => {
  const getService = () =>
    getTestDataSource()
      .then(getSingletons)
      .then(({ lexiconService }) => lexiconService);

  describe('Core Types', () => {
    type ServiceProvider<T extends BaseType> = (
      s: LexiconService,
    ) => CRUDService<T>;
    type TestParams<T extends BaseType> = {
      type: string;
      data: Partial<T>;
      provider: ServiceProvider<T>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args: TestParams<any>[] = [
      {
        type: 'lexica',
        data: { name: 'Greek' },
        provider: (s: LexiconService) => s.lexica,
      },
      {
        type: 'lexical categories',
        data: { name: 'noun' },
        provider: (s: LexiconService) => s.lexicalCategories,
      },
      {
        type: 'grammatical categories',
        data: { name: 'case' },
        provider: (s: LexiconService) => s.grammaticalCategories,
      },
      {
        type: 'grammemes',
        data: { name: 'nominative' },
        provider: (s: LexiconService) => s.grammemes,
      },
      {
        type: 'lexemes',
        data: { lemma: 'οἶκος' },
        provider: (s: LexiconService) => s.lexemes,
      },
      {
        type: 'word forms',
        data: { text: 'οἶκοι' },
        provider: (s: LexiconService) => s.wordForms,
      },
    ];

    it.each(args)('Creates $type', async ({ data, provider }) => {
      const lexiconService = await getService();
      const service = provider(lexiconService);

      const created = await service.create(data);
      expect(created).toMatchObject(data);

      const found = await service.findOneBy({ id: created.id });
      expect(found).toMatchObject(created);
    });

    it.todo('Creates lexical categories');
    it.todo('Creates grammatical categories');
    it.todo('Creates grammemes');
    it.todo('Creates lexemes');
    it.todo('Creates word forms');
  });

  describe('Relationships', () => {
    it.todo('relates lexical categories to lexica');
    it.todo('relates grammatical categories to lexica');
    it.todo('relates lexemes to lexical categories');
    it.todo('relates word forms to lexemes');
    it.todo('relates grammemes to grammatical categories');
  });

  describe('Validations', () => {
    it.todo('checks that a grammeme applies to a grammatical category');
    it.todo('checks that a grammatical category applies to a lexical category');
    it.todo('checks that a lexeme has one lemma');
  });
});
