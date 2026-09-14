import { useTaskComments } from '../model/useTaskComments.ts'
import { TaskCommentComposer } from './TaskCommentComposer.tsx'

/**
 * Тонкий контейнер, который `TaskDetailsPanel` монтирует как `SidePanel`'s `footer` — только пока
 * `taskId` не `null` (панель открыта), поэтому `useTaskComments(taskId)` здесь безусловен внутри
 * компонента (условно само его наличие в дереве), без нарушения правил хуков. Второй вызов
 * `useTaskComments` для того же `taskId`, что уже использует `TaskStatusControl` для списка
 * комментариев, — не дублирующий сетевой запрос: запрос комментариев кэшируется React Query по
 * общему `queryKey`, а независимый экземпляр `useMutation` здесь нужен именно для того, чтобы
 * `isSubmitting` отражал отправку из футера, а не был завязан на internals `TaskStatusControl`.
 */
export type TaskCommentComposerContainerProps = {
    taskId: string
}

export function TaskCommentComposerContainer({ taskId }: TaskCommentComposerContainerProps) {
    const { addComment, isAdding } = useTaskComments(taskId)
    return <TaskCommentComposer onAddComment={addComment} isSubmitting={isAdding} />
}
