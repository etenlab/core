import { NodeType } from '@eten-lab/models';
import { DbService } from '../../services/db.service';
import { SyncService } from '../../services/sync.service';

export class NodeTypeRepository {
  constructor(
    private readonly dbService: DbService,
    private readonly syncService: SyncService,
  ) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(NodeType);
  }

  async createNodeType(type_name: string): Promise<string> {
    let nodeType = await this.repository.findOneBy({ type_name });

    if (nodeType === null) {
      nodeType = await this.repository.save({
        type_name,
        sync_layer: this.syncService.syncLayer,
      });
    }

    return nodeType.type_name;
  }

  async listNodeTypes(): Promise<NodeType[]> {
    const node_types = await this.repository.find({ select: ['type_name'] });

    return node_types;
  }
}
