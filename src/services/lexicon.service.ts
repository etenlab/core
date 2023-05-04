import { GraphSecondLayerService } from './graph-second-layer.service';
import { InferType, object, Schema, string } from 'yup';
import { NodeRepository } from '../repositories/node/node.repository';
import { baseSchema, BaseType, CRUDService } from './crud-service';
import { NodeTypeConst } from '../constants/graph.constant';

const lexiconSchema = baseSchema.concat(
  object({
    name: string().min(1).required(),
  }),
);
export type Lexicon = InferType<typeof lexiconSchema>;

const lexicalCategorySchema = baseSchema.concat(
  object({
    name: string().min(1).required(),
  }),
);
export type LexicalCategory = InferType<typeof lexicalCategorySchema>;

const grammaticalCategorySchema = baseSchema.concat(
  object({
    name: string().min(1).required(),
  }),
);
export type GrammaticalCategory = InferType<typeof grammaticalCategorySchema>;

const grammemeSchema = baseSchema.concat(
  object({
    name: string().min(1).required(),
  }),
);
export type Grammeme = InferType<typeof grammemeSchema>;

const lexemeSchema = baseSchema.concat(
  object({
    lemma: string().min(1).required(),
  }),
);
export type Lexeme = InferType<typeof lexemeSchema>;

const wordFormSchema = baseSchema.concat(
  object({
    text: string().min(1).required(),
  }),
);
export type WordForm = InferType<typeof wordFormSchema>;

export class LexiconService {
  public readonly lexica: CRUDService<Lexicon>;
  public readonly lexicalCategories: CRUDService<LexicalCategory>;
  public readonly grammaticalCategories: CRUDService<GrammaticalCategory>;
  public readonly grammemes: CRUDService<Grammeme>;
  public readonly lexemes: CRUDService<Lexeme>;
  public readonly wordForms: CRUDService<WordForm>;

  constructor(
    secondLayerService: GraphSecondLayerService,
    nodeRepo: NodeRepository,
  ) {
    const service = <T extends BaseType>(model: string, schema: Schema<T>) =>
      new CRUDService(model, schema, secondLayerService, nodeRepo);

    this.lexica = service(NodeTypeConst.LEXICON, lexiconSchema);

    this.lexicalCategories = service(
      NodeTypeConst.LEXICAL_CATEGORY,
      lexicalCategorySchema,
    );

    this.grammaticalCategories = service(
      NodeTypeConst.GRAMATICAL_CATEGORY,
      grammaticalCategorySchema,
    );

    this.grammemes = service(NodeTypeConst.GRAMMEME, grammemeSchema);

    this.lexemes = service(NodeTypeConst.LEXEME, lexemeSchema);

    this.wordForms = service(NodeTypeConst.WORD_FORM, wordFormSchema);
  }
}
