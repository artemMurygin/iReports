import { Command, CommandProps } from '@/shared/domain/command.base';
import { CreateSalaryRuleProps } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

export class CreateSalaryRuleCommand extends Command {
    readonly motivationSchemaId: string;

    readonly rule: CreateSalaryRuleProps;

    // ID сотрудника Bitrix24 — цель схемы мотивации, которой принадлежит
    // правило (см. MotivationTarget.getId(), только для targetType ===
    // 'Employee'). null для схемы на отдел. Единственный потребитель —
    // правило TaskCompleted (design.md change salary-rule-bitrix-task,
    // Requirement "Создание правила-задачи только в схеме на сотрудника"):
    // CreateSalaryRuleHandler создаёт задачу Bitrix24 с ответственным =
    // этот ID, поэтому вызывающая сторона (CreateMotivationSchemaHandler/
    // UpdateMotivationSchemaHandler — обе уже знают target схемы) обязана
    // передать его сюда, а не резолвить схему заново внутри хендлера.
    readonly responsibleId?: number | null;

    constructor(props: CommandProps<CreateSalaryRuleCommand>) {
        super(props);
        this.motivationSchemaId = props.motivationSchemaId;
        this.rule = props.rule;
        this.responsibleId = props.responsibleId ?? null;
    }
}
