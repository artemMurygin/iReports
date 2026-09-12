import { Command, CommandProps } from '@/shared/domain/command.base';

// DELETE .../salary-rules/:ruleId (add-task-rule-task-lifecycle) —
// немедленное удаление ОДНОГО правила направления service вместе с его
// задачей (TaskCompletion), в отличие от UpdateMotivationSchemaHandler,
// который удаляет правила ТОЛЬКО как побочный эффект полной замены набора
// правил схемы на PATCH. Нужен, потому что правило TaskCompletion не может
// существовать без своей задачи (см. WHY в delete-salary-rule.handler.ts):
// пользователь удаляет задачу правила из формы — правило должно исчезнуть
// сразу же, не дожидаясь отдельного «Сохранить схему».
export class DeleteSalaryRuleCommand extends Command {
    readonly ruleId: string;

    constructor(props: CommandProps<DeleteSalaryRuleCommand>) {
        super(props);
        this.ruleId = props.ruleId;
    }
}
