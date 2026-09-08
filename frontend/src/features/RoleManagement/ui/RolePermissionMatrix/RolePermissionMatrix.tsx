import { Fragment, useMemo } from 'react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import type { PermissionMatrixRole } from '../../model/useRolePermissionsMatrix.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.2); architecture.md
 * `features/RoleManagement/ui/RolePermissionMatrix`: "Матрица "роль × permission" с чекбоксами";
 * ui-design.md фрейм `s5nMLx`, узел «Permission Matrix» (`dEJpT`): шапка «Право доступа» + одна
 * колонка на роль, строки сгруппированы по `group` (заголовок группы — `canvas`-заливка на всю
 * ширину), ячейка права — лейбл + код `resource:action` приглушённым моно-подобным шрифтом.
 *
 * `useRolePermissionsMatrix` (раздел 19) отдаёт данные "по ролям" (`matrix: PermissionMatrixRole[]`,
 * каждая роль несёт полный список ячеек каталога) — этот компонент транспонирует их в строки
 * "по праву" для рендера, беря упорядоченный список прав из первой роли (каталог один и тот же
 * для всех ролей, см. `useRolePermissionsMatrix`'s `matrix` useMemo).
 *
 * Явной кнопки сохранения на макете нет (сам макет — иллюстративные placeholder-данные для
 * демонстрации layout, ui-design.md "Отклонения от architecture.md") — хук отдаёт
 * `save(roleId)`, применяющий накопленный черновик чекбоксов ОДНОЙ роли разом (`PATCH
 * /roles/:id/permissions` заменяет весь набор, spec: roles#immediate-permission-changes), поэтому
 * здесь добавлена по кнопке «Сохранить» под каждой колонкой роли — необходимый интерактивный
 * элемент, а не отступление от контента макета.
 */
export type RolePermissionMatrixProps = {
    matrix: PermissionMatrixRole[]
    onToggle: (roleId: string, permissionCode: string) => void
    onSave: (roleId: string) => void
    isSaving?: boolean
}

type PermissionRow = {
    code: string
    label: string
    group: string
    showGroupHeader: boolean
}

function RolePermissionMatrix({ matrix, onToggle, onSave, isSaving }: RolePermissionMatrixProps) {
    const rows = useMemo<PermissionRow[]>(() => {
        const cells = matrix[0]?.permissions ?? []
        return cells.map(({ code, label, group }, index) => ({
            code,
            label,
            group,
            showGroupHeader: index === 0 || cells[index - 1].group !== group,
        }))
    }, [matrix])

    if (matrix.length === 0 || rows.length === 0) {
        return null
    }

    return (
        <div
            data-slot="role-permission-matrix"
            className="overflow-x-auto rounded-lg border border-hairline bg-surface"
        >
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-hairline bg-canvas">
                        <th className="w-[340px] px-4 py-2.5 text-left font-ui text-xs font-semibold text-ink">
                            Право доступа
                        </th>
                        {matrix.map((role) => (
                            <th
                                key={role.roleId}
                                className="min-w-[120px] px-3 py-2.5 text-center font-ui text-xs font-semibold text-ink"
                            >
                                {role.roleName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        return (
                            <Fragment key={row.code}>
                                {row.showGroupHeader && (
                                    <tr>
                                        <td
                                            colSpan={matrix.length + 1}
                                            className="border-b border-hairline bg-canvas px-4 py-1.5 font-ui text-[11px] font-semibold text-ink-muted"
                                        >
                                            {row.group}
                                        </td>
                                    </tr>
                                )}
                                <tr data-slot="matrix-row" className="border-b border-hairline">
                                    <td className="px-4 py-2.5">
                                        <div className="flex flex-col gap-px">
                                            <span className="font-ui text-[13px] font-medium text-ink">
                                                {row.label}
                                            </span>
                                            <span className="font-display text-[10px] text-ink-faint">{row.code}</span>
                                        </div>
                                    </td>
                                    {matrix.map((role) => {
                                        const cell = role.permissions.find((permission) => permission.code === row.code)
                                        return (
                                            <td key={role.roleId} className="px-3 py-2.5 text-center">
                                                <Checkbox
                                                    checked={cell?.checked ?? false}
                                                    onCheckedChange={() => onToggle(role.roleId, row.code)}
                                                    aria-label={`${row.label}: ${role.roleName}`}
                                                    className="mx-auto"
                                                />
                                            </td>
                                        )
                                    })}
                                </tr>
                            </Fragment>
                        )
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td className="px-4 py-2.5" />
                        {matrix.map((role) => (
                            <td key={role.roleId} className="px-3 py-2.5 text-center">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={isSaving}
                                    onClick={() => onSave(role.roleId)}
                                    aria-label={`Сохранить права роли ${role.roleName}`}
                                >
                                    Сохранить
                                </Button>
                            </td>
                        ))}
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}

export { RolePermissionMatrix }
