import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopErpCashDocument } from '@/domains/shop/modules/accounting/domain/entities/shop-erp-cash-document.entity';
import { ShopErpCashDocumentRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-erp-cash-document-repository.port';
import { ShopErpCashDocumentAlreadyExistsException } from '@/domains/shop/modules/accounting/domain/exceptions/erp-cash-document.exception';
import { ShopErpCashDocumentMapper } from '../mappers/shop-erp-cash-document.mapper';

// Обращается к ТОЙ ЖЕ таблице erp_cash_documents, что и ErpCashDocumentRepository
// направления service (см. prisma/schema/erp-cash.prisma — общая таблица,
// не разбивается по доменам, backend/CLAUDE.md), через тот же Prisma-
// делегат (this.client.erpCashDocument), но всегда подставляет/фильтрует
// свой фиксированный direction = 'shop' (Фаза 4
// docs/service-shop-boundary-violations-fix) — независимый класс, не
// переиспользующий ErpCashDocumentRepository domains/service.
@Injectable()
export class ShopErpCashDocumentRepository
    extends PrismaRepository
    implements ShopErpCashDocumentRepositoryPort
{
    private readonly mapper = new ShopErpCashDocumentMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: ShopErpCashDocument): Promise<void> {
        try {
            await this.write(entity, (client) =>
                client.erpCashDocument.create({
                    data: this.mapper.toPersistence(entity),
                }),
            );
        } catch (error) {
            // Уникальный индекс transactionId (erp-cash.prisma, общий на
            // всю таблицу) — защита от задвоения на уровне БД.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new ShopErpCashDocumentAlreadyExistsException(
                    entity.transactionId,
                );
            }
            throw error;
        }
    }

    async deleteById(id: string): Promise<void> {
        await this.write(null, (client) =>
            client.erpCashDocument.delete({
                where: { id, direction: 'shop' },
            }),
        );
    }

    async findByTransactionId(
        transactionId: string,
    ): Promise<ShopErpCashDocument | null> {
        const record = await this.client.erpCashDocument.findFirst({
            where: { transactionId, direction: 'shop' },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findByTransactionIds(
        transactionIds: string[],
    ): Promise<ShopErpCashDocument[]> {
        if (transactionIds.length === 0) {
            return [];
        }
        const records = await this.client.erpCashDocument.findMany({
            where: { transactionId: { in: transactionIds }, direction: 'shop' },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
