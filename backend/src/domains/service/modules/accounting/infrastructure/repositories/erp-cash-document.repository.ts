import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ErpCashDocument } from '@/domains/service/modules/accounting/domain/entities/erp-cash-document.entity';
import { ErpCashDocumentRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document-repository.port';
import { ErpCashDocumentAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/erp-cash.exception';
import { ErpCashDocumentMapper } from '../mappers/erp-cash-document.mapper';

@Injectable()
export class ErpCashDocumentRepository
    extends PrismaRepository
    implements ErpCashDocumentRepositoryPort
{
    private readonly mapper = new ErpCashDocumentMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: ErpCashDocument): Promise<void> {
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
                throw new ErpCashDocumentAlreadyExistsException(
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

    async findByTransactionId(
        transactionId: string,
    ): Promise<ErpCashDocument | null> {
        const record = await this.client.erpCashDocument.findUnique({
            where: { transactionId },
        });
        return record ? this.mapper.toDomain(record) : null;
    }
}
