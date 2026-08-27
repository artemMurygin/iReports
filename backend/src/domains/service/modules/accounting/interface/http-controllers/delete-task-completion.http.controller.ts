import { Controller, Delete, GoneException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';

// Requirement "Вывод из эксплуатации воркфлоу TaskCompletion" (spec.md) и
// design.md, Decision 10, шаг 1 — см. WHY в create-task-completion.http.controller.ts.
@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class DeleteTaskCompletionHttpController {
    @Delete(routesV1.service.accounting.taskCompletionById)
    @ApiOperation({
        summary:
            'Отключено: воркфлоу TaskCompletion выведен из эксплуатации — правило TaskCompleted привязывается к задаче Bitrix24',
    })
    delete(): never {
        throw new GoneException(
            'Воркфлоу TaskCompletion выведен из эксплуатации: записи ' +
                'больше нельзя удалить через этот эндпоинт',
        );
    }
}
