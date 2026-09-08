import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../../../../../prisma/generated/prisma/schema/client';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalaryTask } from '@/domains/service/modules/accounting/domain/entities/salary-task/salary-task.entity';
import { SalaryTaskRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-task/salary-task.port';
import { SalaryTaskAlreadyExistsException } from '@/domains/service/modules/accounting/domain/exceptions/salary-task.exception';
import { BITRIX_TASK_STATUS_COMPLETED } from '@/integrations/bitrix/schema';
import { SalaryTaskMapper } from '../../mappers/salary-task/salary-task.mapper';

// Раздел 9 tasks.md (add-task-based-salary-rule): Prisma-репозиторий поверх
// общей таблицы salary_tasks (design.md Decision 1, backend/CLAUDE.md
// "Общие таблицы между service и shop") для направления service — КАЖДЫЙ
// метод сам подставляет/фильтрует direction: 'service' в data/WHERE,
// direction не принимается ни одним методом порта параметром снаружи
// (изоляция направлений на уровне кода, тот же приём, что
// SalaryRuleRepository). Зеркало — ShopSalaryTaskRepository (раздел 14),
// полностью независимый класс поверх той же Prisma-модели.
@Injectable()
export class SalaryTaskRepository
    extends PrismaRepository
    implements SalaryTaskRepositoryPort
{
    private readonly mapper = new SalaryTaskMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async findByRuleAndPeriod(
        salaryRuleId: string,
        period: string,
    ): Promise<SalaryTask | null> {
        const record = await this.client.salaryTask.findUnique({
            where: {
                salaryRuleId_period: { salaryRuleId, period },
                // Дефенсивный фильтр направления поверх составного
                // уникального ключа — тот же приём, что
                // SalaryRuleRepository.findById (direction: 'service' в
                // WHERE, даже когда естественный ключ уже однозначен).
                direction: 'service',
            },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async findActiveForDirection(): Promise<SalaryTask[]> {
        const records = await this.client.salaryTask.findMany({
            where: {
                direction: 'service',
                // "Неактивная"/архивная задача — уже известная как
                // "Завершена" (design.md Decision 3, тот же критерий, что
                // SalaryTaskStatusSyncService.run(), раздел 8).
                taskStatus: { not: String(BITRIX_TASK_STATUS_COMPLETED) },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    async insert(entity: SalaryTask): Promise<void> {
        try {
            await this.write(entity, (client) =>
                client.salaryTask.create({
                    data: this.mapper.toPersistence(entity),
                }),
            );
        } catch (error) {
            // Уникальный индекс (salaryRuleId, period) — защита от
            // задвоения (design.md Decision 1/4): P2002 → понятное доменное
            // исключение, тот же приём, что
            // PayoutCashboxRecordAlreadyExistsException у
            // PayoutCashboxRecordRepository.
            if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            ) {
                throw new SalaryTaskAlreadyExistsException(
                    entity.salaryRuleId,
                    entity.period,
                );
            }
            throw error;
        }
    }

    async save(entity: SalaryTask): Promise<void> {
        await this.write(entity, (client) =>
            client.salaryTask.update({
                where: { id: entity.id },
                data: {
                    taskStatus: entity.taskStatus.code,
                    lastSyncedAt: entity.lastSyncedAt,
                    deadline: entity.deadline,
                },
            }),
        );
    }

    // Раздел 12 tasks.md — батч-вход erpData.taskCompletionStatuses (один
    // запрос на несколько правил сразу за конкретный период), см. WHY у
    // порта. Пустой список правил не делает запрос — вызывающие (сборка
    // контекста без TaskCompletion-правил в схеме) не должны платить лишним
    // походом в БД.
    async findManyByRulesAndPeriod(
        salaryRuleIds: string[],
        period: string,
    ): Promise<SalaryTask[]> {
        if (salaryRuleIds.length === 0) {
            return [];
        }
        const records = await this.client.salaryTask.findMany({
            where: {
                direction: 'service',
                period,
                salaryRuleId: { in: salaryRuleIds },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }

    // Раздел 12 tasks.md — вход UpdateMotivationSchemaHandler при удалении
    // правила TaskCompletion, см. WHY у порта. Вне зависимости от периода
    // (в отличие от findByRuleAndPeriod/findManyByRulesAndPeriod выше).
    async findActiveByRule(salaryRuleId: string): Promise<SalaryTask[]> {
        const records = await this.client.salaryTask.findMany({
            where: {
                salaryRuleId,
                direction: 'service',
                taskStatus: { not: String(BITRIX_TASK_STATUS_COMPLETED) },
            },
        });
        return records.map((record) => this.mapper.toDomain(record));
    }
}
