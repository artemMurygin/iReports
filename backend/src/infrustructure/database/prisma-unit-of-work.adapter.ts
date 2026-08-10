import { Injectable } from '@nestjs/common';
import { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { DatabaseService } from './database.service';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWorkPort {
    constructor(private readonly db: DatabaseService) {}

    run<T>(work: () => Promise<T>): Promise<T> {
        return this.db.withTransaction(work);
    }
}
