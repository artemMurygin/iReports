import { Injectable } from '@nestjs/common';
import { BitrixService } from './bitrix.service';
import {
    BitrixTasksGatewayPort,
    CreateBitrixTaskInput,
} from './ports/bitrix-tasks-gateway.port';

/**
 * Раздел 6 tasks.md (add-task-based-salary-rule) — тонкий адаптер над
 * `BitrixService`, по образцу `RoappGatewayAdapter`: только делегирование,
 * без собственной бизнес-логики/валидации/ретраев (это уже реализовано в
 * `BitrixService`, раздел 5, design.md Decision 2).
 */
@Injectable()
export class BitrixTasksGatewayAdapter implements BitrixTasksGatewayPort {
    constructor(private readonly bitrix: BitrixService) {}

    createTask(
        input: CreateBitrixTaskInput,
    ): Promise<{ bitrixTaskId: string }> {
        return this.bitrix.createTask(input);
    }

    closeTask(bitrixTaskId: string): Promise<void> {
        return this.bitrix.closeTask(bitrixTaskId);
    }

    updateDeadline(bitrixTaskId: string, deadline: Date): Promise<void> {
        return this.bitrix.updateTaskDeadline(bitrixTaskId, deadline);
    }
}
