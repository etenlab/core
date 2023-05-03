import { GraphSecondLayerService } from './graph-second-layer.service';
import { NodeRepository } from '@/repositories/node/node.repository';
import { NodePropertyValueRepository } from '@/repositories/node/node-property-value.repository';
import {
  NodeTypeConst,
  RelationshipTypeConst,
  PropertyKeyConst,
} from '@/constants/graph.constant';
import { type Node } from '@eten-lab/models';
import { VotingService } from './voting.service';
import { ElectionTypeConst } from '../constants/voting.constant';

export class TableService {
  constructor(
    private readonly secondLayerService: GraphSecondLayerService,
    private readonly nodeRepo: NodeRepository,
    private readonly nodePropertyValueRepo: NodePropertyValueRepository,
    private readonly votingService: VotingService,
  ) {}
  async createTable(name: string): Promise<Nanoid> {
    const table_id = await this.getTable(name);
    if (table_id) {
      return table_id;
    }

    const new_table = await this.secondLayerService.createNodeFromObject(
      NodeTypeConst.TABLE,
      {
        name,
      },
    );

    return new_table.id;
  }

  async getTable(name: string): Promise<Nanoid | null> {
    const table = await this.nodeRepo.getNodeByProp(NodeTypeConst.TABLE, {
      key: PropertyKeyConst.NAME,
      value: name,
    });

    if (!table) {
      return null;
    }

    return table.id;
  }

  async createColumn(table: Nanoid, column_name: string): Promise<Nanoid> {
    const column_id = await this.getColumn(table, column_name);

    if (column_id) {
      return column_id;
    }

    const { node } =
      await this.secondLayerService.createRelatedToNodeFromObject(
        RelationshipTypeConst.TABLE_TO_COLUMN,
        {},
        table,
        NodeTypeConst.TABLE_COLUMN,
        { name: column_name },
      );

    return node.id;
  }

  async getColumn(table: Nanoid, column_name: string): Promise<Nanoid | null> {
    const column = await this.nodeRepo.findOne(
      ['propertyKeys', 'propertyKeys.propertyValue', 'fromNodeRelationships'],
      {
        node_type: NodeTypeConst.TABLE_COLUMN,
        propertyKeys: {
          property_key: PropertyKeyConst.NAME,
          propertyValue: {
            property_value: JSON.stringify({ value: column_name }),
          },
        },
        fromNodeRelationships: {
          from_node_id: table,
        },
      },
    );

    if (!column) {
      return null;
    }

    return column.id;
  }

  async listColumns(table: Nanoid): Promise<Node[]> {
    const columns = await this.nodeRepo.find(
      ['propertyKeys', 'propertyKeys.propertyValue', 'fromNodeRelationships'],
      {
        node_type: NodeTypeConst.TABLE_COLUMN,
        fromNodeRelationships: {
          from_node_id: table,
        },
      },
    );

    return columns;
  }

  async createRow(table: Nanoid): Promise<Nanoid> {
    const { node } =
      await this.secondLayerService.createRelatedToNodeFromObject(
        RelationshipTypeConst.TABLE_TO_ROW,
        {},
        table,
        NodeTypeConst.TABLE_ROW,
        {},
      );
    return node.id;
  }

  async getRow(
    table: Nanoid,
    finder: (table: Nanoid) => Promise<Nanoid | null>,
  ): Promise<Nanoid | null> {
    const row_id = await finder(table);
    return row_id;
  }

  async listRows(table: Nanoid): Promise<Node[]> {
    const rows = await this.nodeRepo.find(['fromNodeRelationships'], {
      node_type: NodeTypeConst.TABLE_ROW,
      fromNodeRelationships: {
        from_node_id: table,
      },
    });

    return rows;
  }

  async createCell(
    column: Nanoid,
    row: Nanoid,
    value: unknown,
  ): Promise<Nanoid> {
    const pseudo_cell = await this.getPseudoCell(column, row);
    let election;
    if (!pseudo_cell.length) {
      const pseudo_cell_id = await this.addCell(
        column,
        row,
        value,
        NodeTypeConst.TABLE_CELL_PSEUDO,
      );
      election = await this.votingService.createElection(
        ElectionTypeConst.TABLE_CELL,
        pseudo_cell_id,
        'nodes',
        'nodes',
      );
    } else {
      election = await this.votingService.getElectionByRef(
        ElectionTypeConst.TABLE_CELL,
        pseudo_cell[0].id,
        'nodes',
      );
    }
    const cell_id = await this.addCell(
      column,
      row,
      value,
      NodeTypeConst.TABLE_CELL,
    );

    await this.votingService.addCandidate(election!.id, cell_id);

    return cell_id;
  }

  async addCell(
    column: Nanoid,
    row: Nanoid,
    value: unknown,
    cell_type: string,
  ): Promise<Nanoid> {
    const cell = await this.secondLayerService.createNodeFromObject(cell_type, {
      data: value,
    });

    await this.secondLayerService.createRelationshipFromObject(
      RelationshipTypeConst.TABLE_COLUMN_TO_CELL,
      {},
      column,
      cell.id,
    );

    await this.secondLayerService.createRelationshipFromObject(
      RelationshipTypeConst.TABLE_ROW_TO_CELL,
      {},
      row,
      cell.id,
    );

    return cell.id;
  }

  async getPseudoCell(column: Nanoid, row: Nanoid): Promise<Node[]> {
    const cells = await this.getCells(column, row);
    return cells.filter(
      (cell) => cell.node_type === NodeTypeConst.TABLE_CELL_PSEUDO,
    );
  }

  async getDataCells(column: Nanoid, row: Nanoid): Promise<Node[]> {
    const cells = await this.getCells(column, row);
    return cells.filter((cell) => cell.node_type === NodeTypeConst.TABLE_CELL);
  }

  async getCells(column: Nanoid, row: Nanoid): Promise<Node[]> {
    const cells = await this.nodeRepo.repository
      .createQueryBuilder('node')
      .leftJoinAndSelect('node.nodeType', 'nodeType')
      .leftJoinAndSelect('node.fromNodeRelationships', 'fromNodeRelationships')
      .leftJoinAndSelect('fromNodeRelationships.fromNode', 'fromNode')
      .leftJoinAndSelect('node.propertyKeys', 'propertyKeys')
      .leftJoinAndSelect('propertyKeys.propertyValue', 'propertyValue')
      .where('fromNode.id IN (:...ids)', { ids: [column, row] })
      .groupBy('node.id')
      .having('COUNT(fromNode.id) = 2')
      .getMany();

    return cells;
  }

  async readCell(column: Nanoid, row: Nanoid): Promise<unknown> {
    const cells = await this.getDataCells(column, row);

    if (!cells.length) {
      return null;
    }
    const pseudo_cell = await this.getPseudoCell(column, row);

    const election = await this.votingService.getElectionByRef(
      ElectionTypeConst.TABLE_CELL,
      pseudo_cell[0].id,
      'nodes',
    );

    let maxVote = 0;
    let maxVotedCellData = JSON.parse(
      cells[0].propertyKeys[0].propertyValue.property_value,
    ).value;

    for (const cell of cells) {
      const data = JSON.parse(
        cell.propertyKeys[0].propertyValue.property_value,
      ).value;

      console.log(election!.id);
      console.log(cell.id);
      const candidate = await this.votingService.getCandidateByRef(
        election!.id,
        cell.id,
      );
      console.log(candidate);

      const votes = await this.votingService.getVotesStats(candidate!.id);
      const vote = votes.upVotes - votes.downVotes;
      if (maxVote <= vote) {
        maxVote = vote;
        maxVotedCellData = data;
      }
    }

    return maxVotedCellData;
  }

  async updateCell(
    column: Nanoid,
    row: Nanoid,
    value: unknown,
  ): Promise<unknown> {
    const cell = await this.nodeRepo.repository
      .createQueryBuilder('node')
      .leftJoinAndSelect('node.fromNodeRelationships', 'fromNodeRelationships')
      .leftJoinAndSelect('fromNodeRelationships.fromNode', 'fromNode')
      .leftJoinAndSelect('node.propertyKeys', 'propertyKeys')
      .leftJoinAndSelect('propertyKeys.propertyValue', 'propertyValue')
      .where('fromNode.id IN (:...ids)', { ids: [column, row] })
      .groupBy('node.id')
      .having('COUNT(fromNode.id) = 2')
      .getOne();

    if (!cell) {
      return null;
    }

    const updated_cell = await this.nodePropertyValueRepo.repository.save({
      ...cell.propertyKeys[0].propertyValue,
      property_value: JSON.stringify(value),
    });

    return updated_cell.id;
  }
}
