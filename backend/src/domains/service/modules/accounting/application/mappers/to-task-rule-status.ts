import type { TaskRuleStatus } from 'ireports-contracts';
import { BITRIX_TASK_STATUS } from '@/integrations/bitrix/bitrix-api.types';
import type { BitrixTaskStatus } from '@/integrations/bitrix/bitrix-api.types';

// Маппинг сырого статуса задачи Bitrix24 Tasks ('1'..'7') в бизнес-статус
// правила TaskCompleted (design.md change salary-rule-bitrix-task, Decision
// 6) — единственное место application-слоя, которое переводит интеграцию
// (src/integrations/bitrix) в доменный тип; домен (TaskCompletedEntity) сам
// от src/integrations/bitrix не зависит (backend/CLAUDE.md, "domain never
// imports from infrastructure").
const RAW_TO_BUSINESS_STATUS: Partial<
    Record<BitrixTaskStatus, TaskRuleStatus>
> = {
    [BITRIX_TASK_STATUS.PENDING]: 'PENDING',
    [BITRIX_TASK_STATUS.IN_PROGRESS]: 'IN_PROGRESS',
    [BITRIX_TASK_STATUS.COMPLETED]: 'COMPLETED',
};

// Остальные нативные коды Bitrix24 Tasks (1 Новая, 4 Ожидает контроля, 6
// Отложена, 7 Отклонена) не участвуют в маппинге на бизнес-статус (design.md,
// Decision 6) — возвращается null, тот же приём, что и у нераспознанного
// тега периода: не блокирует прогноз (calculate() прогноза не смотрит на
// статус), но и не даёт факта (факт требует status === 'COMPLETED').
export function toTaskRuleStatus(
    raw: BitrixTaskStatus | null,
): TaskRuleStatus | null {
    if (raw === null) {
        return null;
    }
    return RAW_TO_BUSINESS_STATUS[raw] ?? null;
}
