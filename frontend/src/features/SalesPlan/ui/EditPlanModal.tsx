import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { SalesDirection } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Modal } from '@/shared/ui-kit/organisms/Modal'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatPeriodLabel } from '@/features/SalesPlan/model/format.ts'
import { useUpdateSalesPlanRows, type PlanRowUpdate } from '@/features/SalesPlan/model/useUpdateSalesPlanRows.ts'

const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

type FieldValues = { turnover: string; margin: string }
type UpdateSalesPlanPayload = { turnover?: number; margin?: number }

export type EditPlanModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    direction: SalesDirection
    period: string
    /** Already resolved by the caller to the effective edit set — selected rows if the page's
     * selection (`useSalesPlanSelection`) is non-empty, otherwise every row currently visible.
     * See `SalesPlanPage`. */
    rows: SalesPlanRow[]
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `XttYX` (`ERP/Organism/Modal`) — its own
 * base definition already ships the exact copy this modal needs ("Редактирование плана
 * продаж" title, "Магазин «Тверская» · август 2026"-shaped subtitle, "Изменения применятся
 * после сохранения" footer hint, "Отмена"/"Сохранить план" actions), so this is effectively the
 * component the design's placeholder `Content Slot` (`F5F0I`) was left generic for — one
 * editable `Input`/`Input` (turnover/margin) pair per category row, not part of the base
 * component itself.
 *
 * Opened from `PageHeader`'s "Изменить план" button (`JjkSX`/`e1D3nB`). `rows` is always the
 * already-resolved edit set (selection-or-all — see the prop doc); this component only renders
 * inputs and diffs them against each row's current `plan.turnover`/`plan.margin`, it doesn't
 * know about `useSalesPlanSelection` at all.
 */
function EditPlanModal({ open, onOpenChange, direction, period, rows }: EditPlanModalProps) {
    const [values, setValues] = useState<Record<string, FieldValues>>({})
    const updateRows = useUpdateSalesPlanRows(direction)

    // Re-seed `values` from `rows`' current plan numbers every time the modal transitions from
    // closed -> open (render-time "adjusting state" comparison, same convention as
    // `useSalesPlanSelection`'s reset-on-direction-change, rather than a `useEffect` — see that
    // hook's comment for why). Keyed on the `open` transition itself (not on `rows`) so a
    // previous failed-save draft isn't silently reset out from under the user while the modal
    // is still open for a retry, but reopening it later always starts from fresh defaults.
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) {
            setValues(
                Object.fromEntries(
                    rows.map((row) => [row.plan.id, { turnover: String(row.plan.turnover), margin: String(row.plan.margin) }]),
                ),
            )
        }
    }

    function setField(planId: string, field: keyof FieldValues, value: string) {
        setValues((prev) => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }))
    }

    const updates: PlanRowUpdate[] = []
    let hasInvalidField = false

    for (const row of rows) {
        const field = values[row.plan.id]
        if (!field) continue

        const turnover = Number(field.turnover)
        const margin = Number(field.margin)
        if (field.turnover.trim() === '' || field.margin.trim() === '' || Number.isNaN(turnover) || Number.isNaN(margin)) {
            hasInvalidField = true
            continue
        }

        const payload: UpdateSalesPlanPayload = {}
        if (turnover !== row.plan.turnover) payload.turnover = turnover
        if (margin !== row.plan.margin) payload.margin = margin
        if (payload.turnover !== undefined || payload.margin !== undefined) {
            updates.push({ id: row.plan.id, categoryName: row.categoryName, ...payload })
        }
    }

    const canSave = updates.length > 0 && !hasInvalidField && !updateRows.isPending

    function handleCancel() {
        onOpenChange(false)
    }

    function handleSave() {
        if (!canSave) return

        updateRows.mutate(updates, {
            onSuccess: (results) => {
                const failed = results.filter((result) => !result.ok)

                if (failed.length === 0) {
                    toast.success(updates.length === 1 ? 'План категории обновлён' : `Обновлено категорий: ${updates.length}`)
                    onOpenChange(false)
                    return
                }

                toast.error(failed.length === results.length ? 'Не удалось сохранить план' : 'Сохранены не все категории', {
                    description: failed.map((result) => `${result.categoryName}: ${result.error}`).join('; '),
                })
            },
            onError: (error) => {
                toast.error('Не удалось сохранить план', { description: error.message })
            },
        })
    }

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title="Редактирование плана продаж"
            subtitle={`${DIRECTION_LABEL[direction]} · ${formatPeriodLabel(period)}`}
            footer={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="font-ui text-xs text-ink-muted">Изменения применятся после сохранения</span>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="ghost" onClick={handleCancel} disabled={updateRows.isPending}>
                            Отмена
                        </Button>
                        <Button type="button" onClick={handleSave} disabled={!canSave}>
                            {updateRows.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                            Сохранить план
                        </Button>
                    </div>
                </div>
            }
        >
            {rows.length === 0 ? (
                <p className="font-ui text-sm text-ink-muted">Нет категорий для редактирования.</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {rows.map((row) => {
                        const field = values[row.plan.id] ?? { turnover: String(row.plan.turnover), margin: String(row.plan.margin) }
                        return (
                            <div key={row.plan.id} className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-canvas p-3">
                                <span className="font-ui text-sm font-medium text-ink">{row.categoryName}</span>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <label className="flex flex-col gap-1">
                                        <span className="font-ui text-xs text-ink-muted">План, ₽</span>
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            value={field.turnover}
                                            onChange={(e) => setField(row.plan.id, 'turnover', e.target.value)}
                                        />
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="font-ui text-xs text-ink-muted">Маржа, ₽</span>
                                        <Input
                                            type="number"
                                            inputMode="decimal"
                                            value={field.margin}
                                            onChange={(e) => setField(row.plan.id, 'margin', e.target.value)}
                                        />
                                    </label>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </Modal>
    )
}

export { EditPlanModal }
