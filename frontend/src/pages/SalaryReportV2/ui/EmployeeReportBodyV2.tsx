import { useState } from 'react'

import { TaskDetailsPanel } from '@/features/TaskStatusControl'
import { formatPeriodLabel } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import type {
    DirectionReportVM,
    SalaryDirection,
    SalaryReportRule,
    SalaryReportRuleWithDirection,
} from '@/features/SalaryReportData'

import { splitRulesByType } from '../model/groupRulesByType.ts'

import { DirectionSourceCard } from './DirectionSourceCard.tsx'
import type { EmployeeReportBodyV2Props } from './EmployeeReportBodyV2.types.ts'
import { EmptyStateCard, ErrorStateCard } from './ReportStatusCard.tsx'
import { RuleGroupDetailsPanel } from './RuleGroupDetailsPanel.tsx'
import { SalesPlanDetailsPanel } from './SalesPlanDetailsPanel.tsx'
import { TaskSourceCard } from './TaskSourceCard.tsx'
import { TotalsBentoCard } from './TotalsBentoCard.tsx'

/** Порядок направлений в бенто-раскладке — всегда "Сервис" перед "Магазин", независимо от порядка,
 * в котором `report.directions[]` пришёл с бэкенда (см. `EmployeeReportVM`'s комментарий — массив
 * длины 0/1/2 без гарантированного порядка). */
const DIRECTION_ORDER: SalaryDirection[] = ['service', 'shop']

/** Скелетон на время `isLoading` — силуэт под бенто-раскладку (карточка "Итого" + карточка
 * "Источники", тот же приём, что и старый скелетон под карточку-гроссбух до этой правки). */
function EmployeeReportSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-hidden>
            <div className="h-[104px] animate-pulse rounded-xl border border-hairline bg-surface md:h-[112px]" />
            <div className="h-[280px] animate-pulse rounded-xl border border-hairline bg-surface" />
        </div>
    )
}

/** Панель детализации группы правил роли — открывается кликом по строке роли
 * (`DirectionSourceCard`), см. `RuleGroupDetailsPanel`. Строка задачи (`TaskSourceCard`) больше не
 * использует эту панель — клик по ней открывает саму задачу (`openTaskId` ниже) напрямую. */
type RuleGroupPanelState = {
    title: string
    rules: SalaryReportRule[]
    direction: SalaryDirection
} | null

/**
 * Тело отчёта сотрудника — бенто-раскладка (Pencil: `design/sallary-first-iteration.pen`, узел
 * `YCxrT` "Вариант C · Бенто-источники" — десктоп, `L2Ztk` "Вариант C · Моб. · Бенто-источники" —
 * мобайл; см. полную карту узлов и контракт пропсов в `EmployeeReportBodyV2.types.ts`). Сам решает,
 * что показать (пусто/ошибка/загрузка/данные) — тот же контракт состояний, что и раньше.
 *
 * Собирает четыре карточки данных из уже готовых VM (`report`): `TotalsBentoCard` ("Итого"),
 * `TaskSourceCard` ("Источник · Задачи" — `TaskCompletion`-правила ОБОИХ направлений сразу,
 * `splitRulesByType` на каждом направлении + склейка с проставленным `direction`), и по одной
 * `DirectionSourceCard` на направление с хотя бы одним ролевым (не-`TaskCompletion`) правилом.
 * Клик по строке роли и по ссылке "Подробнее" плана продаж открывают боковые панели
 * (`RuleGroupDetailsPanel`/`SalesPlanDetailsPanel`); клик по строке задачи открывает саму задачу
 * (`features/TaskStatusControl`'s `TaskDetailsPanel`, `openTaskId`) — не сводку правила. Всё это —
 * чисто презентационный `useState` этого компонента, не бизнес-состояние страницы.
 *
 * Раскладка: мобильный порядок (`xl:hidden`) — "Итого" -> "Сервис" -> "Магазин" -> "Задачи" одним
 * вертикальным стеком; десктопный (`hidden xl:grid`, `L2Ztk`) — "Итого"+"Задачи" в левой колонке
 * фиксированной ширины 448px, "Сервис"+"Магазин" в правой области. Обе раскладки рендерят одни и те
 * же (стейтless) карточки в разном порядке/группировке — переключение через раздельные блоки, а не
 * CSS `order`, потому что группировка карточек между раскладками, а не только их порядок, отличается
 * (см. `EmployeeReportBodyV2.types.ts`'s комментарий).
 */
export function EmployeeReportBodyV2({
    report,
    isLoading,
    errorMessage,
    isEmployeeSelected,
    className,
}: EmployeeReportBodyV2Props) {
    const [ruleGroupPanel, setRuleGroupPanel] = useState<RuleGroupPanelState>(null)
    const [salesPlanDirection, setSalesPlanDirection] = useState<SalaryDirection | null>(null)
    const [openTaskId, setOpenTaskId] = useState<string | null>(null)

    function handleOpenRoleGroup(title: string, rules: SalaryReportRule[], direction: SalaryDirection) {
        setRuleGroupPanel({ title, rules, direction })
    }

    if (!isEmployeeSelected) {
        return (
            <EmptyStateCard className={className}>Выберите сотрудника, чтобы увидеть отчёт по зарплате.</EmptyStateCard>
        )
    }

    if (errorMessage) {
        return <ErrorStateCard className={className}>{errorMessage}</ErrorStateCard>
    }

    if (isLoading || !report) {
        return <EmployeeReportSkeleton />
    }

    if (report.directions.length === 0) {
        return (
            <EmptyStateCard className={className}>
                У сотрудника нет отчёта по зарплате ни в одном направлении за {formatPeriodLabel(report.period)}.
            </EmptyStateCard>
        )
    }

    const taskRules: SalaryReportRuleWithDirection[] = report.directions.flatMap((direction) =>
        splitRulesByType(direction.rules).taskRules.map((rule) => ({ ...rule, direction: direction.direction })),
    )
    const hasTaskCard = taskRules.length > 0

    const directionCardsToShow: DirectionReportVM[] = DIRECTION_ORDER.map((direction) =>
        report.directions.find((directionReport) => directionReport.direction === direction),
    ).filter(
        (direction): direction is DirectionReportVM =>
            direction != null && splitRulesByType(direction.rules).roleRules.length > 0,
    )
    const hasDirectionCards = directionCardsToShow.length > 0

    const salesPlanDirectionReport =
        salesPlanDirection != null ? report.directions.find((d) => d.direction === salesPlanDirection) ?? null : null

    return (
        <div data-slot="employee-report-body-v2" className={cn('flex flex-col gap-4', className)}>
            {/* Мобайл: Итого -> Сервис -> Магазин -> Задачи (см. `L2Ztk`). */}
            <div className="flex flex-col gap-4 xl:hidden">
                <TotalsBentoCard grandTotal={report.grandTotal} isClosed={report.isClosed} />

                {directionCardsToShow.map((direction) => (
                    <DirectionSourceCard
                        key={direction.direction}
                        direction={direction}
                        onOpenRuleGroup={handleOpenRoleGroup}
                        onOpenSalesPlan={setSalesPlanDirection}
                    />
                ))}

                {hasTaskCard && <TaskSourceCard taskRules={taskRules} onOpenTask={setOpenTaskId} />}
            </div>

            {/* Десктоп: Итого + Задачи слева (448px), Сервис/Магазин справа (см. `YCxrT`). */}
            <div
                className={cn(
                    'hidden gap-4 xl:grid xl:items-start',
                    hasDirectionCards ? 'xl:grid-cols-[448px_minmax(0,1fr)]' : 'xl:grid-cols-[448px]',
                )}
            >
                <div className="flex flex-col gap-4">
                    <TotalsBentoCard grandTotal={report.grandTotal} isClosed={report.isClosed} />
                    {hasTaskCard && <TaskSourceCard taskRules={taskRules} onOpenTask={setOpenTaskId} />}
                </div>

                {hasDirectionCards && (
                    <div
                        className={cn(
                            'grid content-start gap-4',
                            directionCardsToShow.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
                        )}
                    >
                        {directionCardsToShow.map((direction) => (
                            <DirectionSourceCard
                                key={direction.direction}
                                direction={direction}
                                onOpenRuleGroup={handleOpenRoleGroup}
                                onOpenSalesPlan={setSalesPlanDirection}
                            />
                        ))}
                    </div>
                )}
            </div>

            <RuleGroupDetailsPanel
                title={ruleGroupPanel?.title ?? ''}
                rules={ruleGroupPanel?.rules ?? []}
                direction={ruleGroupPanel?.direction ?? 'service'}
                period={report.period}
                open={ruleGroupPanel !== null}
                onClose={() => setRuleGroupPanel(null)}
            />

            <TaskDetailsPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />

            <SalesPlanDetailsPanel
                label={salesPlanDirectionReport?.label ?? ''}
                direction={salesPlanDirectionReport?.direction ?? 'service'}
                period={report.period}
                isPlanApproved={salesPlanDirectionReport?.isPlanApproved ?? false}
                salesPerformance={salesPlanDirectionReport?.salesPerformance ?? []}
                open={salesPlanDirectionReport !== null}
                onClose={() => setSalesPlanDirection(null)}
            />
        </div>
    )
}
