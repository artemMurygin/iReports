import { targetRoleSchema } from 'ireports-contracts';
import type { TargetRole, WorkScheduleStatus } from 'ireports-contracts';
import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ShiftHours } from './shift-hours.value-object';

const WORK_SCHEDULE_STATUSES: WorkScheduleStatus[] = [
    'WORKING',
    'DAY_OFF',
    'TIME_OFF',
    'SICK_LEAVE',
    'VACATION',
];

export interface WorkDayProps {
    status: WorkScheduleStatus;
    hours: ShiftHours | null;
    role: TargetRole | null;
    isOnDuty: boolean;
}

export interface CreateWorkDayProps {
    // string, а не WorkScheduleStatus — тем же приёмом, что и role ниже:
    // значение может прийти из БД (мапперы читают WorkScheduleEntry.status
    // как строку, см. work-schedule.prisma), где строка не сужена типом
    // (string уже включает WorkScheduleStatus, отдельно его в union
    // указывать избыточно). parseStatus() ниже сам проверяет принадлежность
    // набору статусов.
    status: string;
    hours?: number | null;
    role?: string | null;
    isOnDuty?: boolean;
}

// Состояние дня целиком: статус + часы + роль. ПОЧЕМУ это один value
// object, а не три поля сущности — они всегда меняются вместе (заполнение
// ячейки таблицы заменяет состояние дня целиком) и связаны общим
// инвариантом: часы и роль осмысленны только у рабочего дня. Держать
// инвариант здесь, а не в WorkScheduleEntry.validate(), значит, что
// невозможно собрать «выходной на 8 часов» вообще нигде — ни в хендлере,
// ни в маппере из БД.
export class WorkDay extends ValueObject<WorkDayProps> {
    static create(props: CreateWorkDayProps): WorkDay {
        const status = WorkDay.parseStatus(props.status);
        const hasHours = props.hours !== undefined && props.hours !== null;
        const hasRole = props.role !== undefined && props.role !== null;
        const isOnDuty = props.isOnDuty ?? false;

        if (status !== 'WORKING') {
            // Не «молча обнуляем», а отклоняем: часы/роль у выходного —
            // это ошибка вызывающего (например, UI не сбросил слайдер при
            // смене статуса), и тихое игнорирование спрятало бы её.
            if (hasHours) {
                throw new ArgumentInvalidException(
                    `Часы смены допустимы только у статуса WORKING, получен статус ${status}`,
                );
            }
            if (hasRole) {
                throw new ArgumentInvalidException(
                    `Роль дня допустима только у статуса WORKING, получен статус ${status}`,
                );
            }
            if (isOnDuty) {
                throw new ArgumentInvalidException(
                    `Отметка дежурства допустима только у статуса WORKING, получен статус ${status}`,
                );
            }
            return new WorkDay({
                status,
                hours: null,
                role: null,
                isOnDuty: false,
            });
        }

        return new WorkDay({
            status,
            // Часы у рабочего дня необязательны: смена может быть
            // проставлена раньше, чем известна её длительность (в таблице
            // это ячейка «работает, часы не указаны»).
            hours: hasHours ? ShiftHours.create(props.hours as number) : null,
            role: hasRole ? WorkDay.parseRole(props.role as string) : null,
            isOnDuty,
        });
    }

    get status(): WorkScheduleStatus {
        return this.props.status;
    }

    get hours(): number | null {
        return this.props.hours ? this.props.hours.getValue() : null;
    }

    get role(): TargetRole | null {
        return this.props.role;
    }

    get isOnDuty(): boolean {
        return this.props.isOnDuty;
    }

    isWorking(): boolean {
        return this.props.status === 'WORKING';
    }

    private static parseStatus(value: string): WorkScheduleStatus {
        const status = WORK_SCHEDULE_STATUSES.find(
            (candidate) => candidate === value,
        );
        if (!status) {
            throw new ArgumentInvalidException(
                `Неизвестный статус дня графика: "${value}"`,
            );
        }
        return status;
    }

    // Набор ролей — единый с зарплатными правилами (SalaryRule.targetRole),
    // поэтому проверяем контрактной схемой, а не собственным списком: когда
    // в targetRoleSchema появится OFFICE (Фаза 2), график примет его без
    // правок домена.
    private static parseRole(value: string): TargetRole {
        const parsed = targetRoleSchema.safeParse(value);
        if (!parsed.success) {
            throw new ArgumentInvalidException(
                `Неизвестная роль дня графика: "${value}"`,
            );
        }
        return parsed.data;
    }
}
