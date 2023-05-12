import {
  NodeTypeConst,
  PropertyKeyConst,
  RelationshipTypeConst,
} from '../constants/graph.constant';
import { ElectionTypeConst } from '../constants/voting.constant';
import { TableNameConst } from '../constants/table-name.constant';

import { GraphFirstLayerService } from './graph-first-layer.service';
import { GraphSecondLayerService } from './graph-second-layer.service';
// import { GraphThirdLayerService } from './graph-third-layer.service';
import { VotingService } from './voting.service';
import { VotableContent, VotableItem } from '../dtos/votable-item.dto';
import { makeFindPropsByLang } from '../utils/LangUtils';
import { LanguageInfo } from '@eten-lab/ui-kit/dist/LangSelector/LangSelector';

export class DefinitionService {
  constructor(
    private readonly graphFirstLayerService: GraphFirstLayerService,
    private readonly graphSecondLayerService: GraphSecondLayerService,
    // private readonly graphThirdLayerService: GraphThirdLayerService,
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
    switch (electionTargetNode?.nodeType.type_name) {
      case NodeTypeConst.PHRASE:
        relationshipType = RelationshipTypeConst.PHRASE_TO_DEFINITION;
        break;
      case NodeTypeConst.WORD:
        relationshipType = RelationshipTypeConst.WORD_TO_DEFINITION;
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
    let relationship = await this.graphFirstLayerService.findRelationship(
      electionTargetId,
      votableNodeId,
      relationshipType as string,
    );

    if (!relationship) {
      relationship = await this.graphFirstLayerService.createRelationship(
        electionTargetId,
        votableNodeId,
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

    const { electionId } = await this.createDefinitionsElection(forNodeId);

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
   * Creates election of type 'definition' for given item (word/phrase/etc..)
   *
   * @param itemId - Nanoid of the word/phrase/etc node
   * @returns - created election Id (to add definition candidates to it)
   */
  async createDefinitionsElection(
    itemId: string,
  ): Promise<{ electionId: Nanoid }> {
    const definitionEelection = await this.votingService.createElection(
      ElectionTypeConst.DEFINITION,
      itemId,
      TableNameConst.NODES,
      TableNameConst.RELATIONSHIPS,
    );
    return { electionId: definitionEelection.id };
  }

  /**
   * Find nodes by votableNodesType and landgInfo (sic!: without filtering by ElectionId)
   * and use propertyKeyText as key to find content property in these nodes
   * Return these nodes as VotableContent.
   * Candidates are found nodes by itself (sic!: not a relation nodes)
   * Node: made for words and phrases, because they are elected without any context
   * @param votableNodesType
   * @param langInfo
   * @param propertyKeyText
   * @param customPropValues - optional addtitional clauses to filter result nodes array by properties
   * @returns
   */
  async getSelfVotableContentByLang(
    votableNodesType: NodeTypeConst,
    langInfo: LanguageInfo,
    propertyKeyText: PropertyKeyConst,
    customPropValues?: [{ key: string; value: string }],
  ): Promise<Array<VotableContent>> {
    const findProps = makeFindPropsByLang(langInfo);
    customPropValues && findProps.push(...customPropValues);
    const votableNodesIds = await this.graphFirstLayerService.getNodesByProps(
      votableNodesType as string,
      findProps,
    );

    const vcPromises: Promise<VotableContent>[] = votableNodesIds.map(
      async (votableNodeId) => {
        const candidateSelfId = votableNodeId;
        const { upVotes, downVotes } = await this.votingService.getVotesStats(
          candidateSelfId,
        );
        const content = (await this.graphFirstLayerService.getNodePropertyValue(
          votableNodeId,
          propertyKeyText,
        )) as string;
        return {
          content,
          upVotes,
          downVotes,
          id: votableNodeId,
          candidateId: candidateSelfId,
        };
      },
    );
    return Promise.all(vcPromises);
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
   * Finds nodes with given languageInfo as VotableItems (e.g .VotableItem = word,  with some contents=definitions to be voted)
   * These contents (e.g. definitions) are related to VotebleItem (e.g. word) through ElectionId which connects VotableItem and each of its votable contents
   * Note: Also we vote not on votable contents(defintions) directly, but we vote on relevant relations.
   *
   * From the other hand, VotableItem have own content(not contents!) witch represent item's own value(i.e. word by itself)
   * this item's own content also can be voted, but it isn't connected to anything, we dont care if they have any relation to any ElectionId.
   * Note: Here we vote on word by itself (not relation)
   * @param langNodeId
   * @returns
   */
  async getVotableItems(
    languageInfo: LanguageInfo,
    type: NodeTypeConst,
    customPropValues?: [{ key: string; value: string }],
  ): Promise<Array<VotableItem>> {
    const itemContents = await this.getSelfVotableContentByLang(
      type,
      languageInfo,
      PropertyKeyConst.NAME,
      customPropValues,
    );

    const viPromises = itemContents.map(async (wc) => {
      if (!wc.id) {
        throw new Error(`word ${wc.content} desn't have an id`);
      }
      // election for word to elect definitions.
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
  // async getDefinitionVotableContentByWordId(
  //   wordNodeId: Nanoid,
  // ): Promise<VotableContent[]> {
  //   if (!wordNodeId) {
  //     return [];
  //   }

  //   const wordVotables = await this.getVotableItems(
  //     langDto.id,
  //     langDto.electionWordsId,
  //   );

  //   const wordVotable = wordVotables.find((wt) => wt.title.id === wordNodeId);

  //   if (!wordVotable) {
  //     return [];
  //   }

  //   return wordVotable.contents;
  // }

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
