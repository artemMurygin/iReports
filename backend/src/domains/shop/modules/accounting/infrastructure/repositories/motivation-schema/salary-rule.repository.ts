import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopSalaryRuleMapper } from '../../mappers/motivation-schema/salary-rule.mapper';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// salary-rule.repository.ts (Фаза 13.5, issue #57) — независимая копия для
// направления shop.
@Injectable()
export class ShopSalaryRuleRepository
    extends PrismaRepository
    implements ShopSalaryRuleRepositoryPort
{
    private readonly mapper = new ShopSalaryRuleMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(
        entity: ShopSalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void> {
        await this.write(entity, (client) =>
            client.salaryRule.create({
                data: {
                    ...this.mapper.toPersistence(entity),
                    motivationSchemaId: meta.motivationSchemaId,
                },
            }),
        );
    }

    // PATCH /v1/shop/accounting/motivation-schema/:id — часть "delete all
    // + recreate" (см. UpdateShopMotivationSchemaHandler). direction:
    // 'shop' в WHERE — не задевает правила направления service той же
    // строки motivation_schemas (см. комментарий в
    // ShopSalaryRuleRepositoryPort.deleteAllByMotivationSchema). write(null, ...)
    // — нет конкретного агрегата, чьи domain-события нужно опубликовать.
    async deleteAllByMotivationSchema(
        motivationSchemaId: string,
    ): Promise<void> {
        await this.write(null, (client) =>
            client.salaryRule.deleteMany({
                where: { motivationSchemaId, direction: 'shop' },
            }),
        );
    }
}
