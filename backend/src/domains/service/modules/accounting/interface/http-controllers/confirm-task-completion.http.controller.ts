import { Controller, GoneException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';

// Requirement "Вывод из эксплуатации воркфлоу TaskCompletion" (spec.md) и
// design.md, Decision 10, шаг 1 — см. WHY в create-task-completion.http.controller.ts.
// confirm/reject отключены вместе: оба меняют статус записи TaskCompletion,
// которая больше не участвует в расчёте TaskCompleted.
@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class ConfirmTaskCompletionHttpController {
    @Post(routesV1.service.accounting.confirmTaskCompletion)
    @ApiOperation({
        summary:
            'Отключено: воркфлоу TaskCompletion выведен из эксплуатации — правило TaskCompleted привязывается к задаче Bitrix24',
    })
    confirm(): never {
        throw new GoneException(
            'Воркфлоу TaskCompletion выведен из эксплуатации: подтверждение ' +
                'задачи теперь выполняется в самой задаче Bitrix24',
        );
    }

    @Post(routesV1.service.accounting.rejectTaskCompletion)
    @ApiOperation({
        summary:
            'Отключено: воркфлоу TaskCompletion выведен из эксплуатации — правило TaskCompleted привязывается к задаче Bitrix24',
    })
    reject(): never {
        throw new GoneException(
            'Воркфлоу TaskCompletion выведен из эксплуатации: отклонение ' +
                'задачи теперь выполняется в самой задаче Bitrix24',
        );
    }
}
