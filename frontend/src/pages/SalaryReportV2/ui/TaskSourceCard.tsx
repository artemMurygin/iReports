import { ChevronRight } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'

import { sumAllFactPrognose } from '@/features/SalaryReportData'
import type { SalaryDirection, SalaryReportRule, SalaryReportRuleWithDirection } from '@/features/SalaryReportData'

export type TaskSourceCardProps = {
    /**
     * Правила `type === 'TaskCompletion'` из ОБОИХ направлений сразу (вызывающая сторона собирает
     * их через `splitRulesByType` фундамента по каждому направлению и склеивает результаты) —
     * реэкспортированный контрактный тип `SalaryReportRuleWithDirection` (`SalaryReportRule &
     * { direction }`), уже заведённый в `features/SalaryReportData/model/types.ts` именно под этот
     * случай ("сведённый отчёт сотрудника, оба направления вперемешку"): сам `SalaryReportRule` не
     * хранит направление, а панель детализации (`onOpenRuleGroup`) должна открыться с правильным
     * `direction` конкретного правила, поэтому направление проставляется на уровне каждого правила,
     * а не передаётся одним общим пропом карточки.
     */
    taskRules: SalaryReportRuleWithDirection[]
    /** Открыть панель детализации ОДНОГО задачного правила (`rules.length === 1` в
     * `RuleGroupDetailsPanel` — ожидаемый случай для задачи, см. её JSDoc). */
    onOpenRuleGroup: (title: string, rules: SalaryReportRule[], direction: SalaryDirection) => void
    className?: string
}

/** "N задача/задачи/задач" — количество исходных Bitrix-задач под правилами карточки (сумма
 * `rule.sources.length` по всем `taskRules`, см. `TaskSourceCard`'s JSDoc) — реальные данные из
 * контракта отчёта, не выдуманное число. Локальный хелпер (не выносится в `kernel`/`model` — нужен
 * только этой одной карточке, в отличие от уже общего `pluralizeRules`). */
function pluralizeTasks(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100
    let word: string
    if (mod10 === 1 && mod100 !== 11) word = 'задача'
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'задачи'
    else word = 'задач'
    return `${count} ${word}`
}

/** Заполнение прогресс-трека строки правила — `clamp(fact/prognose*100, 0, 100)`; у правила без
 * прогноза (закрытый период, `prognose === null`) или с прогнозом `<= 0` делить не на что — трек
 * рисуется полностью заполненным (`100`) вместо деления на ноль/отрицательное число (см. задачу:
 * "если prognose null/0 — трек 100% ... не деля на 0"). */
function computeTrackPercent(rule: SalaryReportRule): number {
    const { fact, prognose } = rule.amount
    if (prognose === null || prognose <= 0) return 100
    return Math.max(0, Math.min(100, (fact / prognose) * 100))
}

const TASK_VALUE_COL = 'w-16 shrink-0 text-right md:w-20'

/**
 * Карточка «Источник · Задачи» левой колонки бенто-раскладки сотрудника (Pencil:
 * `design/sallary-first-iteration.pen`, узел `YCxrT`'s `WJ4ES`'s `ydIk9` "Источник · Задачи" —
 * десктоп, `L2Ztk`'s `V2Q6nf` — мобайл): единственная карточка бенто-раскладки, объединяющая
 * `TaskCompletion`-правила ОБОИХ направлений сразу (в отличие от ролевых правил, которые остаются
 * разбитыми по карточкам направлений "Источники", см. `splitRulesByType`).
 *
 * Точка/цвет трека — `violet-ink`/`violet-soft` (существующие токены UI-кита, ближайшие к
 * фиолетовому акценту мокапа `#A855F7`, который не привязан ни к "Сервис", ни к "Магазин" — задачи
 * по своей природе объединяют оба направления, поэтому не подойдёт и `brand-strong`, которым
 * `LedgerRuleRow` красит точки направления "Сервис"): не заводим новый токен под один-единственный
 * дополнительный оттенок, раз в ките уже есть подходящий по смыслу "третий" цвет.
 *
 * Строки правил ЗДЕСЬ НЕ раскрывающиеся (в отличие от `LedgerRuleRow` в карточке-гроссбухе) — клик
 * по строке целиком открывает `RuleGroupDetailsPanel` через `onOpenRuleGroup(rule.name, [rule],
 * rule.direction)` (единственное правило в массиве — тот самый ожидаемый случай "детализации
 * задачи", см. JSDoc `RuleGroupDetailsPanel`).
 *
 * Раскладка строки — два варианта по ширине (мокап сам их различает): `md:`+ повторяет десктопный
 * `ydIk9` (одна строка: название/трек/факт/прогноз/шеврон), ниже `md:` — мобильный `V2Q6nf`
 * (строка "название + факт + шеврон", трек на всю ширину под ней, затем строка "прогноз N ₽ +
 * %"). Левая колонка бенто-раскладки сотрудника — фиксированной ширины (~448px) даже на десктопе
 * (Pencil `WJ4ES`), поэтому даже "десктопная" ветка здесь работает при ширине карточки, близкой к
 * мобильной, а `md:`-порог — это НЕ ширина вьюпорта страницы (`EmployeeReportBodyV2.tsx` не
 * трогается этим файлом), а собственный запас карточки: интегратору стоит проверить итоговую
 * ширину колонки при подключении.
 */
export function TaskSourceCard({ taskRules, onOpenRuleGroup, className }: TaskSourceCardProps) {
    const taskCount = taskRules.reduce((sum, rule) => sum + rule.sources.length, 0)
    const total = sumAllFactPrognose(taskRules.map((rule) => rule.amount))

    return (
        <div
            data-slot="task-source-card"
            className={cn('flex flex-col gap-3.5 rounded-xl border border-hairline bg-surface p-4 md:p-5', className)}
        >
            <div className="flex flex-wrap items-center gap-2">
                <span className="size-2 shrink-0 rounded-full bg-violet-ink" aria-hidden />
                <span className="font-ui text-sm font-bold text-ink">Задачи</span>
                <span className="font-ui text-[11px] text-ink-muted">
                    · {pluralizeRules(taskRules.length)}
                    {taskCount > 0 && ` · ${pluralizeTasks(taskCount)}`}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <span className="font-display text-2xl font-bold tracking-[-0.3px] text-ink tabular-nums">
                    {formatCurrency(total.fact)}
                </span>
                <span className="flex-1" aria-hidden />
                <span className="flex flex-col items-end gap-0.5">
                    <span className="font-ui text-[10px] text-ink-muted">прогноз</span>
                    <span className="font-display text-[13px] font-bold text-ink-muted tabular-nums">
                        {total.prognose === null ? '—' : formatCurrency(total.prognose)}
                    </span>
                </span>
            </div>

            {taskRules.length === 0 ? (
                <p className="text-center font-ui text-xs text-ink-muted">Нет задачных начислений.</p>
            ) : (
                <div className="flex flex-col border-t border-hairline">
                    {taskRules.map((rule) => {
                        const percent = computeTrackPercent(rule)
                        return (
                            <button
                                key={rule.ruleId}
                                type="button"
                                onClick={() => onOpenRuleGroup(rule.name, [rule], rule.direction)}
                                className="flex flex-col gap-1.5 border-b border-hairline py-2.5 text-left transition-colors last:border-b-0 hover:bg-canvas md:flex-row md:items-center md:gap-2"
                            >
                                {/* Десктоп (`md:`+): одна строка — название/трек/факт/прогноз/шеврон, как `ydIk9`. */}
                                <span className="hidden min-w-0 flex-1 truncate font-ui text-xs text-ink md:block">
                                    {rule.name}
                                </span>
                                <span
                                    className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-hairline md:block"
                                    aria-hidden
                                >
                                    <span className="block h-full rounded-full bg-violet-ink" style={{ width: `${percent}%` }} />
                                </span>
                                <span className={cn(TASK_VALUE_COL, 'hidden font-display text-xs font-bold text-ink tabular-nums md:block')}>
                                    {formatCurrency(rule.amount.fact)}
                                </span>
                                <span
                                    className={cn(
                                        TASK_VALUE_COL,
                                        'hidden font-display text-xs font-bold text-ink-faint tabular-nums md:block',
                                    )}
                                >
                                    {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
                                </span>

                                {/* Мобайл (< `md`): "название + факт + шеврон", трек на всю ширину, "прогноз N ₽ + %", как `V2Q6nf`. */}
                                <span className="flex items-center gap-2 md:hidden">
                                    <span className="min-w-0 flex-1 truncate font-ui text-xs font-semibold text-ink">{rule.name}</span>
                                    <span className="font-display text-[13px] font-bold text-ink tabular-nums">
                                        {formatCurrency(rule.amount.fact)}
                                    </span>
                                </span>
                                <span className="h-1 w-full overflow-hidden rounded-full bg-hairline md:hidden" aria-hidden>
                                    <span className="block h-full rounded-full bg-violet-ink" style={{ width: `${percent}%` }} />
                                </span>
                                <span className="flex items-center gap-2 md:hidden">
                                    <span className="font-ui text-[10px] text-ink-faint">
                                        {rule.amount.prognose === null ? 'без прогноза' : `прогноз ${formatCurrency(rule.amount.prognose)}`}
                                    </span>
                                    <span className="flex-1" aria-hidden />
                                    <span className="font-display text-[10px] font-bold text-violet-ink tabular-nums">
                                        {Math.round(percent)}%
                                    </span>
                                </span>

                                <ChevronRight className="hidden size-3 shrink-0 text-ink-faint md:block" aria-hidden />
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
