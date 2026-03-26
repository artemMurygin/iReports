import { INestApplication, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/extension';

@Injectable()
export class DatabaseService extends PrismaClient {
  async onOnModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    await this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
