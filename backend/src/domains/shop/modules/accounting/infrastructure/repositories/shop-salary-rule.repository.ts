import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopSalaryRuleMapper } from '../mappers/shop-salary-rule.mapper';

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
}
