import { useQuery } from '@tanstack/react-query'
import type { Task, TaskDirection } from 'ireports-contracts'

import { salaryReferenceApi } from './api.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 24 — правило/начисление за задачу для блока
 * `SalaryRuleSummaryBlock` (design.md решение 3): направление резолвится через `task.direction`, если
 * оно заполнено — запрашивается только этот домен. Если `direction` не заполнено (часть существующих
 * задач), запрашивается `service`; `shop` подключается ТОЛЬКО после того, как запрос `service`
 * завершился и не нашёл правило (design.md: «опрашивает service, затем shop, использует первый
 * непустой результат») — реализовано через `enabled`, а не через ручной `await` в `queryFn`, чтобы
 * оба запроса оставались обычными `useQuery` (кэш, повторные рендеры, отмена по `signal`).
 * `rule: null`, если ни один домен не нашёл правило (`tasks/salary-rule-panel`).
 *
 * Принимает `Pick<Task, 'id' | 'direction'>`, а не весь `Task` — единственные поля, которые хук
 * читает, и это позволяет вызывающему коду (`TaskStatusControl`) вызывать хук ещё до того, как сама
 * задача загрузилась (когда есть только `taskId` из пропа), не дожидаясь полного `Task`, вместо
 * условного вызова хука (что нарушило бы Rules of Hooks).
 *
 * `direction` в возврате — тот же резолвленный домен (`service`/`shop`), в котором нашлось правило
 * (или явный `task.direction`), нужен группе 26/27 (`SalaryRuleSummaryBlock`'s `onOpen({ruleId,
 * direction})`, tasks.md 26.1) — `salaryRuleSummarySchema` само направление не несёт.
 */
export function useTaskSalaryReference(task: Pick<Task, 'id' | 'direction'>) {
    const taskId = task.id
    const explicitDirection = task.direction

    const serviceEnabled = explicitDirection === 'service' || explicitDirection == null
    const serviceRuleQuery = useQuery({
        ...salaryReferenceApi.getRule('service', taskId),
        enabled: serviceEnabled,
    })

    const shopEnabled =
        explicitDirection === 'shop' ||
        (explicitDirection == null && serviceRuleQuery.isFetched && serviceRuleQuery.data == null)
    const shopRuleQuery = useQuery({
        ...salaryReferenceApi.getRule('shop', taskId),
        enabled: shopEnabled,
    })

    const resolvedDirection: TaskDirection | null =
        explicitDirection === 'service' || explicitDirection === 'shop'
            ? explicitDirection
            : (serviceRuleQuery.data && 'service') || (shopRuleQuery.data && 'shop') || null

    const accrualEnabled = resolvedDirection != null
    const accrualQuery = useQuery({
        ...salaryReferenceApi.getAccrual(resolvedDirection ?? 'service', taskId),
        enabled: accrualEnabled,
    })

    const rule =
        explicitDirection === 'service'
            ? (serviceRuleQuery.data ?? null)
            : explicitDirection === 'shop'
              ? (shopRuleQuery.data ?? null)
              : (serviceRuleQuery.data ?? shopRuleQuery.data ?? null)

    const accrual = accrualEnabled ? (accrualQuery.data ?? null) : null

    const isLoading =
        explicitDirection === 'service'
            ? serviceRuleQuery.isLoading || accrualQuery.isLoading
            : explicitDirection === 'shop'
              ? shopRuleQuery.isLoading || accrualQuery.isLoading
              : serviceRuleQuery.isLoading || (shopEnabled && shopRuleQuery.isLoading) || accrualQuery.isLoading

    return { rule, accrual, direction: rule ? resolvedDirection : null, isLoading }
}
