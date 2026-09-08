import { Inject, Injectable } from '@nestjs/common';
import { TASK_REPOSITORY } from '@/modules/tasks/application/ports/task.repository.port';
import type { TaskRepositoryPort } from '@/modules/tasks/application/ports/task.repository.port';

// specs/tasks/spec.md, Requirement: «Отмена правила закрывает
// незавершённую задачу как неуспешную» — вызывается из
// domains/{service,shop}/modules/accounting при удалении/отмене
// TaskCompletion-правила, с уже известным taskId из
// config.taskIdByPeriod (design.md Decision 5/architecture.md — этот
// сервис не ищет задачу сам по правилу/периоду, только по переданному id).
@Injectable()
export class CancelTaskForRuleDeletionService {
    constructor(
        @Inject(TASK_REPOSITORY)
        private readonly taskRepo: TaskRepositoryPort,
    ) {}

    async cancel(taskId: string): Promise<void> {
        const task = await this.taskRepo.findById(taskId);
        // Ссылка на несуществующую/удалённую задачу — design.md Risks:
        // «Ссылка на несуществующий taskId... сама себя проявит на первом
        // же расчёте отчёта» — здесь тот же принцип, no-op без исключения,
        // не ломает удаление/отмену правила.
        if (!task) {
            return;
        }
        // Task.cancelForRuleDeletion() сама no-op на терминальном статусе —
        // но проверяем здесь ЕЩЁ РАЗ явно, чтобы не дёргать persistence
        // лишний раз для уже закрытой задачи.
        if (task.status.isTerminal()) {
            return;
        }
        task.cancelForRuleDeletion();
        await this.taskRepo.update(task);
    }
}
