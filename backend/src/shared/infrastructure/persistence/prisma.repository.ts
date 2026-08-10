import { Prisma } from '../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { RequestContextService } from '@/shared/application/context/AppRequestContext';

// Общая инфраструктурная база для Prisma-репозиториев. Не generic CRUD-порт
// (тот был намеренно убран, см. shared/domain/repository.port.ts) — каждый
// репозиторий по-прежнему пишет свои типизированные методы под конкретный
// агрегат, здесь только механика доступа к БД и публикации событий.
export abstract class PrismaRepository {
    protected constructor(private readonly db: DatabaseService) {}

    // Клиент для чтений: подхватывает открытую транзакцию через
    // RequestContext, если она есть, иначе обычный DatabaseService.
    protected get client(): Prisma.TransactionClient | DatabaseService {
        return this.db.getClient();
    }

    // Любая запись должна идти через write(), а не напрямую через client —
    // это гарантирует, что запись всегда происходит в транзакции (даже
    // одиночная — reentrancy-guard в db.withTransaction не даст открыть
    // вложенную, если снаружи уже есть unitOfWork.run()) и что domain-
    // события затронутого агрегата попадут в очередь на публикацию,
    // которая сработает только после реального коммита
    // (см. DatabaseService.withTransaction).
    protected async write<T>(
        entity: unknown,
        work: (
            client: Prisma.TransactionClient | DatabaseService,
        ) => Promise<T>,
    ): Promise<T> {
        return this.db.withTransaction(async () => {
            const result = await work(this.client);
            if (entity instanceof AggregateRoot) {
                RequestContextService.trackAggregateForEvents(entity);
            }
            return result;
        });
    }
}
