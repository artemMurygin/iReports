import type { TaskLink as TaskLinkContract } from 'ireports-contracts';
import type { TaskLink } from '@/modules/tasks/domain/entities/task-link.entity';

// TaskLink (ответ API) — contracts/commands/task.ts, taskLinkSchema. label —
// contract использует optional (undefined), domain — nullable; null
// маппится в undefined. По прецеденту to-task-response.ts.
export function toTaskLinkResponse(link: TaskLink): TaskLinkContract {
    return {
        id: link.id,
        taskId: link.taskId,
        url: link.url.value,
        label: link.label ?? undefined,
        createdAt: link.createdAt,
    };
}
