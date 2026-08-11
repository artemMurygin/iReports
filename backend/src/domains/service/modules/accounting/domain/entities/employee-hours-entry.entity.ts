import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { Period } from '@/shared/domain/period.value-object';

// Ручной ввод отработанных часов сотрудника за период — минимальный источник
// данных для PayPerHour.calculate() (Фаза 7, см.
// docs/payroll/plan-payroll-calculation.md; полноценный график работы вне
// скоупа, см. prd-payroll-calculation.md, "Не в скоупе"). Одна запись — одна
// пара (сотрудник, период); уникальность обеспечивает БД
// (@@unique в salary.prisma), как и у остальных сущностей модуля.
export interface EmployeeHoursEntryProps {
    employeeId: number;
    period: string;
    hours: number;
}

export class EmployeeHoursEntry extends Entity<EmployeeHoursEntryProps> {
    declare protected readonly _id: AggregateID;

    static create(props: EmployeeHoursEntryProps): EmployeeHoursEntry {
        return new EmployeeHoursEntry({ id: randomUUID(), props });
    }

    get employeeId(): number {
        return this.props.employeeId;
    }

    get period(): string {
        return this.props.period;
    }

    get hours(): number {
        return this.props.hours;
    }

    // Правка — замена значения целиком, employeeId/period неизменны (это
    // была бы уже другая запись).
    edit(hours: number): void {
        this.props.hours = hours;
        this.validate();
    }

    validate(): void {
        if (
            !Number.isInteger(this.props.employeeId) ||
            this.props.employeeId <= 0
        ) {
            throw new ArgumentInvalidException(
                'Необходимо указать корректный id сотрудника для записи часов',
            );
        }
        // Бросает ArgumentInvalidException при неверном формате периода.
        Period.create(this.props.period);
        if (this.props.hours < 0) {
            throw new ArgumentInvalidException(
                'Отработанные часы не могут быть отрицательными',
            );
        }
    }
}
