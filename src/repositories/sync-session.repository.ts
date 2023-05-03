import { DbService } from '@/services/db.service';
import { SyncSession } from '@/models/Sync';

export class SyncSessionRepository {
  constructor(private readonly dbService: DbService) {}

  private get repository() {
    return this.dbService.dataSource.getRepository(SyncSession);
  }

  async createSyncSession(fromLayer: number, toLayer: number): Promise<number> {
    const syncSession = await this.repository.save({
      syncFrom: fromLayer,
      syncTo: toLayer,
      createdAt: new Date(),
      completed: false,
    });

    return syncSession.id;
  }

  async completeSyncSession(id: number, error?: Error): Promise<void> {
    await this.repository.update(id, {
      completed: true,
      error: error != null ? error.toString() : undefined,
    });
  }
}
