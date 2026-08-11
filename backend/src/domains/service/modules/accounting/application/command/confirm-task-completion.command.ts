import { Command, CommandProps } from '@/shared/domain/command.base';

export class ConfirmTaskCompletionCommand extends Command {
    readonly taskCompletionId: string;
    readonly confirmedBy: number;
    // Действие «подтвердить» и «отклонить» отличаются только этим флагом —
    // одна команда/один обработчик вместо двух почти идентичных (см.
    // TaskCompletion.confirm()/.reject()).
    readonly approve: boolean;

    constructor(props: CommandProps<ConfirmTaskCompletionCommand>) {
        super(props);
        this.taskCompletionId = props.taskCompletionId;
        this.confirmedBy = props.confirmedBy;
        this.approve = props.approve;
    }
}
