import {
  NodeTypeConst,
  PropertyKeyConst,
  RelationshipTypeConst,
} from '../constants/graph.constant';
import { ElectionTypeConst } from '../constants/voting.constant';
import { TableNameConst } from '../constants/table-name.constant';

import { LanguageWithElecitonsDto } from '../dtos/language.dto';

import { GraphFirstLayerService } from './graph-first-layer.service';
import { GraphSecondLayerService } from './graph-second-layer.service';
import { GraphThirdLayerService } from './graph-third-layer.service';
import { VotingService } from './voting.service';
import { VotableContent, VotableItem } from '../dtos/votable-item.dto';

export class DefinitionService {
  constructor(
    private readonly graphFirstLayerService: GraphFirstLayerService,
    private readonly graphSecondLayerService: GraphSecondLayerService,
    private readonly graphThirdLayerService: GraphThirdLayerService,
    private readonly votingService: VotingService,
  ) {}

  /**
   * Finds candidate entry for a given votableNodeId or creates new candidate entry if not found.
   * We vote on relations, so relation must be a candidate entry target. So if relation between
   * votable node and election target does not exist, it will be created.
   * Relation type and direction is created according to electionTargetNode.nodeType
   *
   * @param votableNodeId - nodeId (definition/word/phrase)
   * @param electionId - in case if no existing candidateEntry found, new one will be created using this electionId
   * @param electionTargetId - nodeId (word/phrase/language)
   * @returns - id of the created candidate entry
   */
  async findOrCreateCandidateId(
    votableNodeId: Nanoid,
    electionId: Nanoid,
    electionTargetId: Nanoid,
  ): Promise<Nanoid> {
    const electionTargetNode = await this.graphFirstLayerService.readNode(
      electionTargetId,
      ['nodeType'],
    );
    const votableNode = await this.graphFirstLayerService.readNode(
      votableNodeId,
      ['nodeType'],
    );
    let relationshipType: RelationshipTypeConst;
    let isDirectionToVotable: boolean;
    switch (electionTargetNode?.nodeType.type_name) {
      case NodeTypeConst.PHRASE:
        relationshipType = RelationshipTypeConst.PHRASE_TO_DEFINITION;
        isDirectionToVotable = true; //relatinos are directed as from phrase to definition, voting is on definition
        break;
      case NodeTypeConst.WORD:
        relationshipType = RelationshipTypeConst.WORD_TO_DEFINITION;
        isDirectionToVotable = true; //relatinos  are directed as from word to definition, voting is on definition
        break;
      case NodeTypeConst.LANGUAGE:
        relationshipType =
          votableNode?.nodeType.type_name === NodeTypeConst.PHRASE
            ? RelationshipTypeConst.PHRASE_TO_LANG
            : RelationshipTypeConst.WORD_TO_LANG;
        isDirectionToVotable = false; //relatinos  are directed as  from phrase/word to language, voting is on phrase/word

        break;
      default:
        throw new Error(
          `
            We don't know which type of Relationship we take for voting 
            if election target type is ${electionTargetNode?.nodeType.type_name} 
            And votable node type is ${votableNode?.nodeType.type_name}
          `,
        );
    }
    const fromNode = isDirectionToVotable ? electionTargetId : votableNodeId;
    const toNode = isDirectionToVotable ? votableNodeId : electionTargetId;
    let relationship = await this.graphFirstLayerService.findRelationship(
      fromNode,
      toNode,
      relationshipType as string,
    );

    if (!relationship) {
      relationship = await this.graphFirstLayerService.createRelationship(
        fromNode,
        toNode,
        relationshipType as string,
      );
    }

    // if candidate exists, it won't be created, Just found and returned.
    const candidate = await this.votingService.addCandidate(
      electionId,
      relationship.id,
    );

    return candidate.id;
  }

  /**
   * Creates defintion for given nodeId and candidate entry for this definition.
   *
   * @param definitionText - definition text
   * @param forNodeId - node Id (word or phrase) for which definition is created
   * @param electionId - election for node Id (word or phrase). Candidate entry will be connected to this election.
   * @returns - created definition Id and candidate Id
   */
  async createDefinition(
    definitionText: string,
    forNodeId: Nanoid,
    electionId: Nanoid,
  ): Promise<{
    definitionId: Nanoid;
    candidateId: Nanoid;
  }> {
    const existingDefinitionNode =
      await this.graphFirstLayerService.getNodeByProp(
        NodeTypeConst.DEFINITION,
        {
          key: PropertyKeyConst.TEXT,
          value: definitionText,
        },
        { from_node_id: forNodeId },
      );

    const definitionNode = existingDefinitionNode
      ? existingDefinitionNode
      : (
          await this.graphSecondLayerService.createRelatedToNodeFromObject(
            RelationshipTypeConst.WORD_TO_DEFINITION,
            {},
            forNodeId,
            NodeTypeConst.DEFINITION,
            { [PropertyKeyConst.TEXT]: definitionText },
          )
        ).node;

    const candidateId = await this.findOrCreateCandidateId(
      definitionNode.id,
      electionId,
      forNodeId,
    );

    return {
      definitionId: definitionNode.id,
      candidateId: candidateId,
    };
  }

  /**
   * Creates word (as votable node for language) and election of type 'definition' for this word
   *
   * @param word - word text
   * @param langId - language of this word
   * @returns - created word Id and election Id (to add definition candidates to it)
   */
  async createWordAndDefinitionsElection(
    word: string,
    langId: Nanoid,
    langElectionId: Nanoid,
  ): Promise<{ wordId: Nanoid; electionId: Nanoid; wordCandidateId: Nanoid }> {
    const wordId = await this.graphThirdLayerService.createWord(word, langId);
    const wordCandidateId = await this.findOrCreateCandidateId(
      wordId,
      langElectionId,
      langId,
    );
    const definitionEelection = await this.votingService.createElection(
      ElectionTypeConst.DEFINITION,
      wordId,
      TableNameConst.NODES,
      TableNameConst.RELATIONSHIPS,
    );
    return { wordId, electionId: definitionEelection.id, wordCandidateId };
  }

  /**
   * Creates phrase and election of type 'definition' for this phrase
   *
   * @param word - phrase text
   * @param langId - language of this phrase
   * @returns - created phrase Id and election Id (to add definition candidates to it)
   */
  async createPhraseAndDefinitionsElection(
    phrase: string,
    langId: Nanoid,
    langElectionId: Nanoid,
  ): Promise<{
    phraseId: Nanoid;
    electionId: Nanoid;
    phraseCandidateId: Nanoid;
  }> {
    const existingPhraseNode = await this.graphFirstLayerService.getNodeByProp(
      NodeTypeConst.PHRASE,
      {
        key: PropertyKeyConst.TEXT,
        value: phrase,
      },
    );
    const node = existingPhraseNode
      ? existingPhraseNode
      : (
          await this.graphSecondLayerService.createRelatedFromNodeFromObject(
            RelationshipTypeConst.PHRASE_TO_LANG,
            {},
            NodeTypeConst.PHRASE,
            { name: phrase },
            langId,
          )
        ).node;

    const phraseCandidateId = await this.findOrCreateCandidateId(
      node.id,
      langElectionId,
      langId,
    );

    const election = await this.votingService.createElection(
      ElectionTypeConst.DEFINITION,
      node.id,
      TableNameConst.NODES,
      TableNameConst.RELATIONSHIPS,
    );
    return { phraseId: node.id, electionId: election.id, phraseCandidateId };
  }

  /**
   * Finds nodes related to electionTargetId (nodes only of given votableNodesType,
   * relation direction described by fromVotableNodes).
   * Finds/creates candidateEntry for each found node using given electionId.
   * Incapsulates information and returns it as VotableContent
   *
   * @param electionTargetId - nodeId (word/phrase/language)
   * @param electionId
   * @param votableNodesType - nodeId (definition/word/phrase)
   * @param propertyKeyText - used to get text of votable content
   * @param fromVotableNodes - set direction of relations. 'true' - default - relationship  is from votable items to election target.
   * @returns
   */

  async getVotableContent(
    electionTargetId: Nanoid,
    electionId: Nanoid,
    votableNodesType: NodeTypeConst,
    propertyKeyText: PropertyKeyConst,
    fromVotableNodes = true,
  ): Promise<Array<VotableContent>> {
    const relationDirection = fromVotableNodes ? 'from_node_id' : 'to_node_id';
    const votableNodes =
      await this.graphFirstLayerService.getNodesByTypeAndRelatedNodes({
        type: votableNodesType,
        [relationDirection]: electionTargetId,
      });
    const vcPromises: Promise<VotableContent>[] = votableNodes.map(
      async (votableNode) => {
        const candidateId = await this.findOrCreateCandidateId(
          votableNode.id,
          electionId,
          electionTargetId,
        );
        const { upVotes, downVotes } = await this.votingService.getVotesStats(
          candidateId,
        );
        const content = (await this.graphFirstLayerService.getNodePropertyValue(
          votableNode.id,
          propertyKeyText,
        )) as string;
        return {
          content,
          upVotes,
          downVotes,
          id: votableNode.id,
          candidateId,
        };
      },
    );
    return Promise.all(vcPromises);
  }

  /**
   * Finds definitions for given node Id and election Id and returns as VotableContent
   *
   * @param forNodeId
   * @param electionId
   * @returns
   */
  async getDefinitionsAsVotableContent(
    forNodeId: Nanoid,
    electionId: Nanoid,
  ): Promise<Array<VotableContent>> {
    return this.getVotableContent(
      forNodeId,
      electionId,
      NodeTypeConst.DEFINITION,
      PropertyKeyConst.TEXT,
    );
  }

  /**
   * Finds Phrases for given language Id as VotableItems
   * For now, not quite sure how vote on phrases (not phrase definitions, but phrase itself, so it is still TODO)
   *
   * @param langNodeId
   * @returns
   */
  async getPhrasesAsVotableItems(
    langNodeId: string,
    langElectionId: Nanoid,
  ): Promise<Array<VotableItem>> {
    const phrasesContents = await this.getVotableContent(
      langNodeId,
      langElectionId,
      NodeTypeConst.PHRASE,
      PropertyKeyConst.NAME,
      false,
    );

    const viPromises = phrasesContents.map(async (pc) => {
      if (!pc.id) {
        throw new Error(`phrase ${pc.content} desn't have an id`);
      }
      // if electionId exists, it won't be created, Just found and returned.
      const election = await this.votingService.createElection(
        ElectionTypeConst.DEFINITION,
        pc.id,
        TableNameConst.NODES,
        TableNameConst.RELATIONSHIPS,
      );
      return {
        title: pc,
        contents: await this.getDefinitionsAsVotableContent(pc.id, election.id),
        contentElectionId: election.id,
      } as VotableItem;
    });
    const vi = await Promise.all(viPromises);
    return vi;
  }

  /**
   * Finds Words for given language Id as VotableItems
   * For now, not quite sure how vote on phrases (not phrase definitions, but phrase itself, so it is still TODO)
   * @param langNodeId
   * @returns
   */
  async getWordsAsVotableItems(
    langNodeId: Nanoid,
    langElectionId: Nanoid,
  ): Promise<Array<VotableItem>> {
    const wordsContents = await this.getVotableContent(
      langNodeId,
      langElectionId,
      NodeTypeConst.WORD,
      PropertyKeyConst.NAME,
      false,
    );

    const viPromises = wordsContents.map(async (wc) => {
      if (!wc.id) {
        throw new Error(`word ${wc.content} desn't have an id`);
      }
      // if electionId exists, it won't be created, Just found and returned.
      const election = await this.votingService.createElection(
        ElectionTypeConst.DEFINITION,
        wc.id,
        TableNameConst.NODES,
        TableNameConst.RELATIONSHIPS,
      );

      return {
        title: wc,
        contents: await this.getDefinitionsAsVotableContent(wc.id, election.id),
        contentElectionId: election.id,
      } as VotableItem;
    });
    const vi = await Promise.all(viPromises);
    return vi;
  }

  /**
   * Finds a word for given language Id and text, then gets all definitions as a VotableItem form.
   * @param word
   * @param langId
   * @returns
   */
  async getDefinitionVotableContentByWord(
    word: string,
    langId: Nanoid,
  ): Promise<VotableContent[]> {
    const langDto = await this.getLanguageById(langId);

    const wordNodeId = await this.graphThirdLayerService.getWord(word, langId);

    if (!wordNodeId || !langDto.electionWordsId) {
      return [];
    }

    const wordVotables = await this.getWordsAsVotableItems(
      langDto.id,
      langDto.electionWordsId,
    );

    const wordVotable = wordVotables.find((wt) => wt.title.id === wordNodeId);

    if (!wordVotable) {
      return [];
    }

    return wordVotable.contents;
  }

  /**
   * Gets all languges. Finds or creates for each language elections of words and phrases
   *
   * @returns
   */
  async getLanguages(): Promise<LanguageWithElecitonsDto[]> {
    const languages = await this.graphThirdLayerService.getLanguages();
    const langPromises: Promise<LanguageWithElecitonsDto>[] = languages.map(
      async (l) => {
        const electionWords = await this.votingService.createElection(
          ElectionTypeConst.WORD_LANGUAGE,
          l.id,
          TableNameConst.NODES,
          TableNameConst.RELATIONSHIPS,
        );
        const electionPhrases = await this.votingService.createElection(
          ElectionTypeConst.PHRASE_LANGUAGE,
          l.id,
          TableNameConst.NODES,
          TableNameConst.RELATIONSHIPS,
        );
        return {
          ...l,
          electionWordsId: electionWords.id,
          electionPhrasesId: electionPhrases.id,
        };
      },
    );
    return Promise.all(langPromises);
  }

  /**
   * Gets languge. Finds or creates language elections of words and phrases
   *
   * @param langId
   * @returns
   */
  async getLanguageById(langId: Nanoid): Promise<LanguageWithElecitonsDto> {
    const languages = await this.getLanguages();

    const lang = languages.find((lang) => lang.id === langId);

    if (!lang) {
      throw new Error(
        `Not Exists given language Node(#langId=${langId}) in the graph schema`,
      );
    }

    return lang;
  }

  /**
   * Updates definition (as text property of given node Id).
   *
   * @param definitionNodeId - node Id to be updated
   * @param newDefinitionValue - new defintion value
   */

  async updateDefinitionValue(
    definitionNodeId: Nanoid,
    newDefinitionValue: string,
  ): Promise<void> {
    this.graphSecondLayerService.updateNodeObject(definitionNodeId, {
      [PropertyKeyConst.TEXT]: newDefinitionValue,
    });
  }
}
