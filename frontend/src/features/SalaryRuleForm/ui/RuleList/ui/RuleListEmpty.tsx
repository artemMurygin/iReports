export type RuleListEmptyProps = {
    /** Пустое состояние показывается вместо нижней кнопки, когда правил ещё нет. */
    visible: boolean
}

/** Пустое состояние списка правил: пунктирная рамка с подсказкой добавить первое правило. */
export function RuleListEmpty({ visible }: RuleListEmptyProps) {
    if (!visible) return null

    return (
        <div className="flex w-full flex-col items-center gap-1 rounded-[10px] border border-dashed border-hairline p-6 text-center">
            <p className="font-ui text-[13px] font-medium text-ink">В схеме пока нет правил</p>
            <p className="font-ui text-xs text-ink-muted">
                Добавьте хотя бы одно правило начисления, чтобы сохранить схему.
            </p>
        </div>
    )
}
