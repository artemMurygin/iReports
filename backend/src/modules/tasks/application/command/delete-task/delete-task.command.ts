import { Command, CommandProps } from '@/shared/domain/command.base';

// DELETE /v1/tasks/:id — полное безвозвратное удаление задачи вместе с её
// комментариями/ссылками. Не путать с CancelTaskForRuleDeletionService: тот
// мягко переводит задачу в терминальный статус при удалении УЖЕ СОХРАНЁННОГО
// правила (истории начислений важна), этот — для задачи, которую пользователь
// явно отвязывает/удаляет из ещё не сохранённого/редактируемого правила
// TaskCompletion (add-task-rule-task-lifecycle).
export class DeleteTaskCommand extends Command {
    readonly taskId: string;

    constructor(props: CommandProps<DeleteTaskCommand>) {
        super(props);
        this.taskId = props.taskId;
    }
}
