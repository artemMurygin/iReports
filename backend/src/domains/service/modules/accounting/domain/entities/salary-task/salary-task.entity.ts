import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { TaskStatus } from '@/domains/service/modules/accounting/domain/value-objects/task-status.value-object';

// Раздел 9 tasks.md (add-task-based-salary-rule): доменная сущность поверх
// Prisma-модели SalaryTask (salary-task.prisma, задача 1.1) — общей для
// service/shop таблицы salary_tasks (design.md Decision 1, backend/CLAUDE.md
// "Общие таблицы между service и shop"). Направление НЕ хранится в props —
// этот класс физически определён в domains/service и всегда представляет
// строку direction='service' (изоляция на уровне кода: маппер/репозиторий
// этого же раздела фиксируют direction='service' при персистентности, а не
// принимают его параметром). Зеркало — ShopSalaryTask (раздел 14),
// независимый класс в domains/shop.
//
// Одна запись на (salaryRuleId, period) — разовое правило (isRecurring =
// false) заводит ровно одну запись за всё время жизни, регулярное — по
// одной на период (design.md Decision 1/4, @@unique([salaryRuleId, period])
// в Prisma-модели — последний рубеж защиты от гонки при автосоздании,
// раздел 11).
export interface CreateSalaryTaskProps {
    salaryRuleId: string;
    period: string;
    deadline: Date;
    isRecurring: boolean;
    bitrixTaskId: string;
    taskStatus: TaskStatus;
    lastSyncedAt?: Date | null;
}

export interface SalaryTaskProps {
    salaryRuleId: string;
    period: string;
    deadline: Date;
    isRecurring: boolean;
    bitrixTaskId: string;
    taskStatus: TaskStatus;
    lastSyncedAt: Date | null;
}

export class SalaryTask extends Entity<SalaryTaskProps> {
    declare protected readonly _id: AggregateID;

    static create(props: CreateSalaryTaskProps): SalaryTask {
        return new SalaryTask({
            id: randomUUID(),
            props: {
                ...props,
                lastSyncedAt: props.lastSyncedAt ?? null,
            },
        });
    }

    get salaryRuleId(): string {
        return this.props.salaryRuleId;
    }

    get period(): string {
        return this.props.period;
    }

    get deadline(): Date {
        return this.props.deadline;
    }

    get isRecurring(): boolean {
        return this.props.isRecurring;
    }

    get bitrixTaskId(): string {
        return this.props.bitrixTaskId;
    }

    get taskStatus(): TaskStatus {
        return this.props.taskStatus;
    }

    get lastSyncedAt(): Date | null {
        return this.props.lastSyncedAt;
    }

    // Обновление статуса задачи через доменный метод (а не прямое присвоение
    // поля извне) — SalaryTaskStatusSyncCron (раздел 8) сознательно
    // обходит домен и пишет напрямую в БД (см. WHY в
    // salary-task-status-sync.service.ts, «обновление taskStatus/
    // lastSyncedAt не несёт доменной бизнес-логики»); этот метод обслуживает
    // остальные пути, идущие через домен/репозиторий этого модуля (создание/
    // закрытие задачи из правила, раздел 12).
    markStatus(status: TaskStatus): void {
        this.props.taskStatus = status;
    }

    validate(): void {
        if (!this.props.salaryRuleId) {
            throw new ArgumentInvalidException(
                'Задача Bitrix24 должна ссылаться на зарплатное правило (salaryRuleId)',
            );
        }
        if (!this.props.period) {
            throw new ArgumentInvalidException(
                'Задача Bitrix24 должна ссылаться на расчётный период (period)',
            );
        }
        if (!this.props.bitrixTaskId) {
            throw new ArgumentInvalidException(
                'Задача Bitrix24 должна иметь bitrixTaskId',
            );
        }
        if (!this.props.deadline) {
            throw new ArgumentInvalidException(
                'Задача Bitrix24 должна иметь дедлайн (deadline)',
            );
        }
    }
}
