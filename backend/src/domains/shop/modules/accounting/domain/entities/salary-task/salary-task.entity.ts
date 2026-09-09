import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import {
    ArgumentInvalidException,
    ArgumentNotProvidedException,
} from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';
import { ShopTaskStatus } from '../../value-objects/task-status.value-object';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// сущности (зеркало domains/service/modules/accounting/domain/entities/
// salary-task/salary-task.entity.ts, раздел 9, issue #57 не пересматривается
// — полностью независимый класс, не переиспользующий доменный код
// service). Задача Bitrix24, связанная с зарплатным правилом
// TaskCompletionShop (раздел 15). Хранится в общей таблице salary_tasks
// (design.md Decision 1) с дискриминатором direction, но изоляция — на
// уровне кода: ShopSalaryTaskRepository (раздел 14.3) всегда
// подставляет/фильтрует direction: 'shop'.
export interface ShopSalaryTaskProps {
    salaryRuleId: string;
    period: Period;
    deadline: Date;
    isRecurring: boolean;
    bitrixTaskId: string;
    taskStatus: ShopTaskStatus;
    lastSyncedAt: Date | null;
}

// Поля, нужные при заведении НОВОЙ задачи (lastSyncedAt ещё не
// синхронизировался, id генерируется здесь же) — отдельно от полного
// набора ShopSalaryTaskProps, который использует маппер при
// восстановлении из персистентности (там lastSyncedAt уже может быть
// заполнен предыдущим тиком SalaryTaskStatusSyncCron).
export interface CreateShopSalaryTaskProps {
    salaryRuleId: string;
    period: Period;
    deadline: Date;
    isRecurring: boolean;
    bitrixTaskId: string;
    taskStatus: ShopTaskStatus;
}

export class ShopSalaryTask extends Entity<ShopSalaryTaskProps> {
    declare protected readonly _id: AggregateID;

    static create(props: CreateShopSalaryTaskProps): ShopSalaryTask {
        return new ShopSalaryTask({
            id: randomUUID(),
            props: {
                ...props,
                lastSyncedAt: null,
            },
        });
    }

    get salaryRuleId(): string {
        return this.props.salaryRuleId;
    }

    get period(): Period {
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

    get taskStatus(): ShopTaskStatus {
        return this.props.taskStatus;
    }

    get lastSyncedAt(): Date | null {
        return this.props.lastSyncedAt;
    }

    // Применяется SalaryTaskStatusSyncService (раздел 8, общая
    // инфраструктура) через ShopSalaryTaskRepository.save() — задача этой
    // сущности не в том, чтобы САМОЙ дёргать Bitrix24 (это делает
    // BitrixTasksGatewayPort), а только зафиксировать локально уже
    // полученный извне статус.
    markStatus(status: ShopTaskStatus, syncedAt: Date = new Date()): void {
        this.props.taskStatus = status;
        this.props.lastSyncedAt = syncedAt;
    }

    validate(): void {
        if (!this.props.salaryRuleId) {
            throw new ArgumentNotProvidedException(
                'Задача зарплатного правила должна ссылаться на правило (salaryRuleId)',
            );
        }
        if (!this.props.bitrixTaskId) {
            throw new ArgumentNotProvidedException(
                'Задача зарплатного правила должна ссылаться на задачу Bitrix24 (bitrixTaskId)',
            );
        }
        if (!this.props.deadline || !(this.props.deadline instanceof Date)) {
            throw new ArgumentNotProvidedException(
                'Задача зарплатного правила должна иметь дедлайн (deadline)',
            );
        }
        if (typeof this.props.isRecurring !== 'boolean') {
            throw new ArgumentInvalidException(
                'Признак регулярности задачи (isRecurring) должен быть булевым',
            );
        }
    }
}
