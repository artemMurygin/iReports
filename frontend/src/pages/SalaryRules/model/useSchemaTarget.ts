import { useCallback, useState } from 'react'

import type { TargetType } from './types.ts'

/**
 * Шаг 1 "Кому начисляем" (Pencil `tSYIw` → `Колонка · Схема` → `Карточка · Схема`): цель начисления
 * (Отдел/Сотрудник + конкретный id) и название схемы. Направление-агностично — тот же
 * `motivation_schemas` ищется/создаётся по `(targetType, targetId)` независимо от направления
 * (направление живёт на уровне отдельных `salary_rules`, см. `ENDPOINTS.md`), поэтому шаг 1 общий
 * для сервиса и магазина и не знает ни об одном из них.
 */
export function useSchemaTarget() {
    const [targetType, setTargetType] = useState<TargetType>('Department')
    const [targetId, setTargetId] = useState<number | null>(null)
    const [schemaName, setSchemaName] = useState('')

    /** Смена "Отдел"/"Сотрудник" сбрасывает выбранный id — он относится к другому справочнику. */
    const handleTargetTypeChange = useCallback((nextType: TargetType) => {
        setTargetType(nextType)
        setTargetId(null)
    }, [])

    const handleTargetIdChange = useCallback((nextId: number) => setTargetId(nextId), [])

    const handleSchemaNameChange = useCallback((nextName: string) => setSchemaName(nextName), [])

    /** "Отмена" мобильного sticky-бара — см. `ui/MobileSaveBar`'s comment on why this resets only
     * Step 1's own fields, not the rule drafts. */
    const reset = useCallback(() => {
        setTargetId(null)
        setSchemaName('')
    }, [])

    const canReset = targetId !== null || schemaName.trim().length > 0

    return {
        targetType,
        targetId,
        schemaName,
        handleTargetTypeChange,
        handleTargetIdChange,
        handleSchemaNameChange,
        reset,
        canReset,
    }
}
