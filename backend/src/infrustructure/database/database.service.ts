import { INestApplication, Injectable, Logger } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
    Prisma,
    PrismaClient,
} from '../../../prisma/generated/prisma/schema/client';
import { RequestContextService } from '../../shared/application/context/AppRequestContext';

@Injectable()
export class DatabaseService extends PrismaClient {
    // Logger из @nestjs/common структурно совпадает с LoggerPort
    // (log/error/warn/debug), поэтому отдельный DI-токен не нужен.
    private readonly logger = new Logger(DatabaseService.name);

    constructor(private readonly eventEmitter: EventEmitter2) {
        const adapter = new PrismaPg({
            connectionString: process.env.DATABASE_URL,
        });
        super({ adapter });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    enableShutdownHooks(app: INestApplication) {
        process.on('beforeExit', () => {
            void app.close();
        });
    }

    /**
     * Клиент для выполнения запросов: если сейчас открыта глобальная
     * транзакция (см. withTransaction), возвращает её TransactionClient,
     * иначе — обычный DatabaseService. Репозитории должны обращаться к
     * базе через него, а не напрямую через this, чтобы прозрачно
     * участвовать в транзакции, если она есть.
     */
    getClient(): Prisma.TransactionClient | DatabaseService {
        return RequestContextService.getTransactionConnection() ?? this;
    }

    /**
     * Оборачивает callback в одну Prisma-транзакцию и кладёт её
     * TransactionClient в RequestContext, чтобы вложенные вызовы
     * репозиториев (через getClient()) участвовали в той же транзакции
     * без явного прокидывания tx через сигнатуры методов.
     *
     * После успешного коммита публикует domain-события, накопленные за
     * время транзакции репозиториями через
     * RequestContextService.trackAggregateForEvents (см. PrismaRepository.write).
     * При откате/ошибке накопленное просто отбрасывается — коммита не было,
     * публиковать нечего.
     */
    async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
        if (RequestContextService.getTransactionConnection()) {
            // Уже внутри транзакции — не открываем вложенную, используем
            // текущую. События опубликует тот вызов, который реально открыл
            // транзакцию (см. ветку ниже) — не этот.
            return callback();
        }

        try {
            const result = await this.$transaction(async (tx) => {
                RequestContextService.setTransactionConnection(tx);
                try {
                    return await callback();
                } finally {
                    RequestContextService.cleanTransactionConnection();
                }
            });

            // this.$transaction(...) зарезолвился без исключения — коммит
            // уже случился, теперь безопасно опубликовать события.
            const aggregates = RequestContextService.drainPendingAggregates();
            await Promise.all(
                aggregates.map((aggregate) =>
                    aggregate.publishEvents(this.logger, this.eventEmitter),
                ),
            );

            return result;
        } catch (error) {
            RequestContextService.drainPendingAggregates();
            throw error;
        }
    }
}
