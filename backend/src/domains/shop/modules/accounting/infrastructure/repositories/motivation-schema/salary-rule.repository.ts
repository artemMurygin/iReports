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

    // PATCH /v1/shop/accounting/motivation-schema/:id — удаляет только
    // правила, реально исключённые из нового набора (diff по id, см.
    // UpdateShopMotivationSchemaHandler). direction: 'shop' в WHERE — не
    // задевает правила направления service той же строки motivation_schemas
    // (см. комментарий в ShopSalaryRuleRepositoryPort.deleteByIds).
    // write(null, ...) — нет конкретного агрегата, чьи domain-события нужно
    // опубликовать.
    async deleteByIds(ruleIds: string[]): Promise<void> {
        if (ruleIds.length === 0) {
            return;
        }
        await this.write(null, (client) =>
            client.salaryRule.deleteMany({
                where: { id: { in: ruleIds }, direction: 'shop' },
            }),
        );
    }

    // Раздел 16 tasks.md (add-task-based-salary-rule) — см. WHY у
    // ShopSalaryRuleRepositoryPort.findById.
    async findById(ruleId: string): Promise<ShopSalaryRule | null> {
        const record = await this.client.salaryRule.findFirst({
            where: { id: ruleId, direction: 'shop' },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async update(entity: ShopSalaryRule): Promise<void> {
        await this.write(entity, (client) =>
            client.salaryRule.update({
                where: { id: entity.id },
                data: { props: this.mapper.toPersistence(entity).props },
            }),
        );
    }
}
