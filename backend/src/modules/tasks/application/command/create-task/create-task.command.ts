import { Command, CommandProps } from '@/shared/domain/command.base';
import type { AccountingDirection } from '@/shared/domain/calculation-context';

// specs/tasks/spec.md, Requirement: «Задача — полностью самостоятельная
// сущность» — НЕ несёт salaryRuleId/period/isRecurring (design.md Decision
// 2/4). Единственный вход создания задачи (architecture.md): и HTTP `POST
// /v1/tasks` (форма с фронта), и CommandBus-диспатч из
// EnsureRuleTaskForPeriodService (domains/{service,shop}/modules/accounting)
// при авто-пересоздании задачи регулярного правила на новый период.
export class CreateTaskCommand extends Command {
    readonly title: string;
    readonly description?: string;
    readonly deadline: Date;
    readonly assigneeEmployeeId: number;
    readonly direction?: AccountingDirection;

    constructor(props: CommandProps<CreateTaskCommand>) {
        super(props);
        this.title = props.title;
        this.description = props.description;
        this.deadline = props.deadline;
        this.assigneeEmployeeId = props.assigneeEmployeeId;
        this.direction = props.direction;
    }
}
