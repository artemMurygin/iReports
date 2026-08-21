import { randomUUID } from 'crypto';
import {
    AggregateID,
    CreateEntityProps,
    Entity,
} from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ScheduleDate } from '../value-objects/schedule-date.value-object';
import { WorkDay } from '../value-objects/work-day.value-object';

// Запись графика: один календарный день одного сотрудника (Фаза 1,
// docs/employee-work-schedule). Уникальность пары (employeeId, date)
// обеспечивает БД (@@unique в work-schedule.prisma) — на уровне приложения
// повторное заполнение того же дня не создаёт вторую запись, а правит
// существующую (см. UpsertWorkScheduleEntryHandler).
//
// Сущность общая на компанию: поля direction здесь нет намеренно — человек
// принадлежит Bitrix-отделу, а не направлению, и один и тот же график
// будут читать расчёты зарплаты обоих направлений (см. PRD).
export interface WorkScheduleEntryProps {
    employeeId: number;
    date: ScheduleDate;
    day: WorkDay;
}

export class WorkScheduleEntry extends Entity<WorkScheduleEntryProps> {
    declare protected readonly _id: AggregateID;

    static create(props: WorkScheduleEntryProps): WorkScheduleEntry {
        return new WorkScheduleEntry({ id: randomUUID(), props });
    }

    // Восстановление из персистентности — отдельный вход, чтобы маппер не
    // зависел от формы конструктора базового класса.
    static reconstitute(
        props: CreateEntityProps<WorkScheduleEntryProps>,
    ): WorkScheduleEntry {
        return new WorkScheduleEntry(props);
    }

    get employeeId(): number {
        return this.props.employeeId;
    }

    get date(): ScheduleDate {
        return this.props.date;
    }

    get day(): WorkDay {
        return this.props.day;
    }

    // Правка — замена состояния дня целиком (статус + часы + роль);
    // employeeId/date неизменны, это естественный ключ записи: другой день
    // или другой сотрудник — уже другая запись.
    edit(day: WorkDay): void {
        this.props.day = day;
        this.validate();
    }

    validate(): void {
        if (
            !Number.isInteger(this.props.employeeId) ||
            this.props.employeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Необходимо указать корректный id сотрудника для записи графика',
            );
        }
    }
}
