import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import {
    SalaryRule,
    TaskCompletionSalaryConfig,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { Period } from '@/shared/domain/period.value-object';
import { SalaryRuleMapper } from '../../mappers/motivation-schema/salary-rule.mapper';

@Injectable()
export class SalaryRuleRepository
    extends PrismaRepository
    implements SalaryRuleRepositoryPort
{
    private readonly mapper = new SalaryRuleMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(
        entity: SalaryRule,
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

    async deleteByIds(ruleIds: string[]): Promise<void> {
        if (ruleIds.length === 0) {
            return;
        }
        // direction: 'service' в WHERE — критично: не задевает правила
        // направления shop (сотрудник с идентичностями в обеих ERP), см.
        // комментарий у SalaryRuleRepositoryPort.deleteByIds.
        await this.write(null, (client) =>
            client.salaryRule.deleteMany({
                where: { id: { in: ruleIds }, direction: 'service' },
            }),
        );
    }

    async findById(id: string): Promise<SalaryRule | null> {
        const record = await this.client.salaryRule.findFirst({
            where: { id, direction: 'service' },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async update(entity: SalaryRule): Promise<void> {
        const { name, targetRole, props } = this.mapper.toPersistence(entity);
        await this.write(entity, (client) =>
            client.salaryRule.update({
                where: { id: entity.id },
                data: { name, targetRole, props },
            }),
        );
    }

    // Раздел 15 tasks.md (add-task-salary-rule-links-comments) — обратный
    // поиск правила по taskId. Полное сканирование правил вида
    // TaskCompletion направления service (см. design.md решение 4 — их
    // ожидаемо мало, отдельная индексная таблица не заводится), сравнение
    // taskIdByPeriod[период] делается в приложении, а не JSON-оператором
    // Prisma/Postgres.
    async findByTaskId(taskId: string): Promise<SalaryRule | null> {
        const records = await this.client.salaryRule.findMany({
            where: { type: 'TaskCompletion', direction: 'service' },
        });
        const currentPeriod = Period.current().getValue();
        for (const record of records) {
            const rule = this.mapper.toDomain(record);
            const config = rule.config as TaskCompletionSalaryConfig;
            if (config.taskIdByPeriod[currentPeriod] === taskId) {
                return rule;
            }
        }
        return null;
    }

    // Раздел 18 tasks.md — см. WHY у SalaryRuleRepositoryPort.findMotivationSchemaId.
    async findMotivationSchemaId(ruleId: string): Promise<string | null> {
        const record = await this.client.salaryRule.findFirst({
            where: { id: ruleId, direction: 'service' },
            select: { motivationSchemaId: true },
        });
        return record?.motivationSchemaId ?? null;
    }
}
