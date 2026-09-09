import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopSalaryTask } from '@/domains/shop/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { ShopTaskStatus } from '@/domains/shop/modules/accounting/domain/value-objects/task-status.value-object';
import { ShopSalaryTaskRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-task/salary-task.port';
import { ShopSalaryTaskMapper } from '../../mappers/salary-task/salary-task.mapper';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// репозитория (зеркало domains/service/modules/accounting/infrastructure/
// repositories/salary-task/salary-task.repository.ts, раздел 9, issue #57
// не пересматривается). Обращается к общей таблице salary_tasks
// (design.md Decision 1, prisma/schema/salary-task.prisma), тот же
// Prisma-делегат client.salaryTask, что и у одноимённого репозитория
// direction service, но ВСЕГДА подставляет/фильтрует
// direction: 'shop' — ни один метод не принимает direction параметром
// снаружи (backend/CLAUDE.md, изоляция направлений на уровне кода).
@Injectable()
export class ShopSalaryTaskRepository
    extends PrismaRepository
    implements ShopSalaryTaskRepositoryPort
{
    private readonly mapper = new ShopSalaryTaskMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByRuleAndPeriod(
        salaryRuleId: string,
        period: string,
    ): Promise<ShopSalaryTask | null> {
        const record = await this.client.salaryTask.findFirst({
            where: { salaryRuleId, period, direction: 'shop' },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findActiveForDirection(): Promise<ShopSalaryTask[]> {
        const records = await this.client.salaryTask.findMany({
            where: {
                direction: 'shop',
                taskStatus: { not: ShopTaskStatus.done().getValue() },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async insert(entity: ShopSalaryTask): Promise<void> {
        await this.write(entity, (client) =>
            client.salaryTask.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async save(entity: ShopSalaryTask): Promise<void> {
        const data = this.mapper.toPersistence(entity);
        await this.write(entity, (client) =>
            client.salaryTask.update({
                where: { id: data.id },
                data: {
                    deadline: data.deadline,
                    isRecurring: data.isRecurring,
                    taskStatus: data.taskStatus,
                    lastSyncedAt: data.lastSyncedAt,
                    updatedAt: data.updatedAt,
                },
            }),
        );
    }

    // Раздел 17 tasks.md — батч-вход erpData.taskCompletionStatuses (один
    // запрос на несколько правил сразу за конкретный период), см. WHY у
    // порта. Пустой список правил не делает запрос — вызывающие (сборка
    // контекста без TaskCompletion-правил в схеме) не должны платить лишним
    // походом в БД.
    async findManyByRulesAndPeriod(
        salaryRuleIds: string[],
        period: string,
    ): Promise<ShopSalaryTask[]> {
        if (salaryRuleIds.length === 0) {
            return [];
        }
        const records = await this.client.salaryTask.findMany({
            where: {
                direction: 'shop',
                period,
                salaryRuleId: { in: salaryRuleIds },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    // Раздел 17 tasks.md — вход UpdateShopMotivationSchemaHandler при
    // удалении правила TaskCompletion, см. WHY у порта. Вне зависимости от
    // периода (в отличие от findByRuleAndPeriod/findManyByRulesAndPeriod
    // выше).
    async findActiveByRule(salaryRuleId: string): Promise<ShopSalaryTask[]> {
        const records = await this.client.salaryTask.findMany({
            where: {
                salaryRuleId,
                direction: 'shop',
                taskStatus: { not: ShopTaskStatus.done().getValue() },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
