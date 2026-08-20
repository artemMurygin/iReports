import { Plus } from 'lucide-react'

export type AddMoreRuleButtonProps = {
    /** Кнопка показывается только когда в схеме уже есть хотя бы одно правило — на пустом списке
     * единственная точка добавления — кнопка в шапке, чтобы не дублировать два почти одинаковых
     * CTA. */
    visible: boolean
    disabled: boolean
    onAdd: () => void
}

/** Нижняя строка-кнопка «Добавить ещё одно правило» под списком правил. */
export function AddMoreRuleButton({ visible, disabled, onAdd }: AddMoreRuleButtonProps) {
    if (!visible) return null

    return (
        <button
            type="button"
            onClick={onAdd}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-hairline bg-canvas p-[12px_14px] font-ui text-xs font-medium text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
            <Plus className="size-[15px]" />
            Добавить ещё одно правило
        </button>
    )
}
