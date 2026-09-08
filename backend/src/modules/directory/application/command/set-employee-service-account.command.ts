import { Command, CommandProps } from '@/shared/domain/command.base';

// Включение/выключение признака «служебный аккаунт» сотрудника
// (docs/employee-ordering-and-salary-filter, Фаза 3) — PATCH
// .../employees/:id/service-account. Как и ReorderEmployeesCommand,
// доступно любому авторизованному пользователю без отдельных прав (модель
// прав в проекте не введена, см. WHY над routesV1.directory).
export class SetEmployeeServiceAccountCommand extends Command {
    readonly employeeId: number;
    readonly isServiceAccount: boolean;

    constructor(props: CommandProps<SetEmployeeServiceAccountCommand>) {
        super(props);
        this.employeeId = props.employeeId;
        this.isServiceAccount = props.isServiceAccount;
    }
}
