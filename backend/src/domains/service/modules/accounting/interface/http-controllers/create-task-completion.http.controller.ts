import { Controller, GoneException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { routesV1 } from '@/config/app.routes';

// Requirement "Вывод из эксплуатации воркфлоу TaskCompletion" (spec.md) и
// design.md, Decision 10, шаг 1: create/confirm/delete TaskCompletion
// отключаются в этом же change — новых записей больше не появится, расчёт
// TaskCompleted читает статус задачи Bitrix24. list/get остаются временно,
// до задачи 11.2 (аудит существующих записей). Контроллер и роут не
// удаляются целиком, чтобы клиенты, ещё не обновлённые на новый воркфлоу,
// получили внятный 410 вместо 404 — полное удаление кода/роута выполняется
// одновременно с задачей 11.2, после runbook-шага 11.1.
@ApiTags('Бухгалтерия: выполнение задач')
@Controller()
export class CreateTaskCompletionHttpController {
    @Post(routesV1.service.accounting.taskCompletions)
    @ApiOperation({
        summary:
            'Отключено: воркфлоу TaskCompletion выведен из эксплуатации — правило TaskCompleted привязывается к задаче Bitrix24',
    })
    create(): never {
        throw new GoneException(
            'Воркфлоу TaskCompletion выведен из эксплуатации: правило ' +
                '"выполненная задача" теперь привязывается к задаче Bitrix24 ' +
                'при создании/редактировании схемы мотивации',
        );
    }
}
