import type { TaskComment as TaskCommentContract } from 'ireports-contracts';
import type { TaskComment } from '@/modules/tasks/domain/entities/task-comment.entity';

// TaskComment (ответ API) — contracts/commands/task.ts, taskCommentSchema.
// По прецеденту to-task-response.ts.
export function toTaskCommentResponse(
    comment: TaskComment,
): TaskCommentContract {
    return {
        id: comment.id,
        taskId: comment.taskId,
        authorEmployeeId: comment.authorEmployeeId,
        text: comment.text,
        createdAt: comment.createdAt,
    };
}
