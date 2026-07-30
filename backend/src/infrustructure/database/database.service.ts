import { INestApplication, Injectable } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  Prisma,
} from '../../../prisma/generated/prisma/schema/client';
import { RequestContextService } from '../../shared/application/context/AppRequestContext';

@Injectable()
export class DatabaseService extends PrismaClient {
  constructor() {
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

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
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
   */
  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    if (RequestContextService.getTransactionConnection()) {
      // Уже внутри транзакции — не открываем вложенную, используем текущую.
      return callback();
    }

    return this.$transaction(async (tx) => {
      RequestContextService.setTransactionConnection(tx);
      try {
        return await callback();
      } finally {
        RequestContextService.cleanTransactionConnection();
      }
    });
  }
}
