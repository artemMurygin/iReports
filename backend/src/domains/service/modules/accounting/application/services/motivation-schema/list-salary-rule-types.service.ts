import { Injectable } from '@nestjs/common';
import type { SalaryRuleTypesResponse } from 'ireports-contracts';
import { listSalaryRuleTypes } from '@/domains/service/modules/accounting/domain/services/salary-rule-role-catalog';

// Application-обёртка над чистой доменной функцией (Фаза 8) — тонкий слой
// ради единообразия с остальными GET-эндпоинтами модуля (interface →
// application → domain), хотя сама функция не обращается к БД: типы
// правил и допустимые роли — статический перечень, зафиксированный в коде
// (см. salary-rule-role-catalog.ts).
@Injectable()
export class ListSalaryRuleTypesService {
    execute(): SalaryRuleTypesResponse {
        return listSalaryRuleTypes();
    }
}
