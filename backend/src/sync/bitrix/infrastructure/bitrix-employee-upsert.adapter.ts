import { Injectable, NotFoundException } from '@nestjs/common';
import { BitrixService } from '../../../integrations/bitrix/bitrix.service';
import { BitrixSyncService } from '../bitrix-sync.service';
import type { BitrixEmployeeUpsertPort } from '../application/ports/bitrix-employee-upsert.port';

// Реализация BITRIX_EMPLOYEE_UPSERT_PORT (design.md, Decision 11) —
// точечный self-heal, вызывается `auth` при отсутствии BitrixEmployee на
// пути логина. Переиспользует BitrixSyncService.upsertEmployeeRecord (тот
// же код, что и массовый uploadEmployees()), не дублирует маппинг полей.
@Injectable()
export class BitrixEmployeeUpsertAdapter implements BitrixEmployeeUpsertPort {
    constructor(
        private readonly bitrix: BitrixService,
        private readonly sync: BitrixSyncService,
    ) {}

    async upsertOne(bitrixUserId: number): Promise<void> {
        const user = await this.bitrix.fetchEmployeeById(bitrixUserId);
        if (!user) {
            throw new NotFoundException(
                `Сотрудник Bitrix24 с id=${bitrixUserId} не найден`,
            );
        }
        await this.sync.upsertEmployeeRecord(user);
    }
}
