import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Cashbox } from '@/domains/service/modules/accounting/domain/entities/payout-cashbox-record.entity';
import { PayoutCashboxRecordRepositoryPort } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import { PayoutCashboxRecordAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { PayoutCashboxRecordMapper } from '../../mappers/erp-cash/payout-cashbox-record.mapper';

@Injectable()
export class PayoutCashboxRecordRepository
    extends PrismaRepository
    implements PayoutCashboxRecordRepositoryPort
{
    private readonly mapper = new PayoutCashboxRecordMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: Cashbox): Promise<void> {
        try {
            await this.write(entity, (client) =>
                client.erpCashDocument.create({
                    data: this.mapper.toPersistence(entity),
                }),
            );
        } catch (error) {
            // Уникальный индекс transactionId (erp-cash.prisma) —
            // защита от задвоения на уровне БД (PRD 3, «Технические
            // ограничения»): тот же приём, что P2002 → SalaryAccrualLineAlreadyAccruedException
            // у BalanceTransactionRepository.insertMany.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new PayoutCashboxRecordAlreadyExistsException(
                    entity.transactionId,
                );
            }
            throw error;
        }
    }

    async deleteById(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.erpCashDocument.delete({ where: { id } }),
        );
    }

    async findByTransactionId(transactionId: string): Promise<Cashbox | null> {
        const record = await this.client.erpCashDocument.findUnique({
            where: { transactionId },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByTransactionIds(transactionIds: string[]): Promise<Cashbox[]> {
        if (transactionIds.length === 0) {
            return [];
        }
        const records = await this.client.erpCashDocument.findMany({
            where: { transactionId: { in: transactionIds } },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
