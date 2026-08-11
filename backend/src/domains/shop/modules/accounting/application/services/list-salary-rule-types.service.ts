import { Injectable } from '@nestjs/common';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { listShopSalaryRuleTypes } from '@/domains/shop/modules/accounting/domain/services/salary-rule-role-catalog';

// Application-обёртка над чистой доменной функцией — зеркало
// ListSalaryRuleTypesService сервиса (Фаза 12). Тип ответа
// (SalaryRuleTypesResponse) переиспользован из ireports-contracts
// напрямую — форма общая для обоих направлений (см.
// shopSalaryRuleTypesResponseSchema в contracts/commands/shop-salary-rule.ts,
// это тот же тип с другим именем экспорта).
@Injectable()
export class ListShopSalaryRuleTypesService {
    execute(): SalaryRuleTypesResponse {
        return listShopSalaryRuleTypes();
    }
}
