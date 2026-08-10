import { Global, Module } from '@nestjs/common';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { DatabaseService } from './database.service';
import { PrismaUnitOfWork } from './prisma-unit-of-work.adapter';

@Global()
@Module({
    providers: [
        DatabaseService,
        { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    ],
    exports: [DatabaseService, UNIT_OF_WORK],
})
export class DatabaseModule {}
