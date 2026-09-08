import type { ReorderEmployeesItem } from 'ireports-contracts';
import { Command, CommandProps } from '@/shared/domain/command.base';

// Сохранение нового порядка сотрудников (docs/employee-ordering-and-salary-filter,
// Фаза 1) — глобальный (не привязанный к отделу/странице) порядок,
// применяемый одинаково на всех списках сотрудников (справочник, отчёт по
// зарплате, взаиморасчёты/баланс, зарплатные схемы, график работы, связи
// сотрудников). Доступно любому авторизованному пользователю без отдельных
// прав (PRD, "В скоупе" п.5) — контроллер намеренно не гардируется, тем же
// приёмом, что и у остальных внутренних read/write-эндпоинтов без ролевой
// модели в проекте (см. WHY над routesV1.directory в app.routes.ts).
export class ReorderEmployeesCommand extends Command {
    readonly items: ReorderEmployeesItem[];

    constructor(props: CommandProps<ReorderEmployeesCommand>) {
        super(props);
        this.items = props.items;
    }
}
