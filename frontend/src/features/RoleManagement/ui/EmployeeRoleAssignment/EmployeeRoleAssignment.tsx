import { Pencil, UserPlus } from 'lucide-react'
import type { RoleResponse } from 'ireports-contracts'

import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Badge } from '@/shared/ui-kit/atoms/Badge'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

import type { EmployeeWithRoles } from '../../model/useEmployeeRoleAssignment.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 20.7 tasks.md; architecture.md
 * `features/RoleManagement/ui/EmployeeRoleAssignment`: "Список сотрудников (из
 * `DIRECTORY_REPOSITORY`) + назначение ролей"; ui-design.md фрейм `F6d3a`, узел «Employee Table»
 * (`B9Bob0`): колонки «Сотрудник» (`i3h5E` `ERP/Atom/Avatar` + имя), «Отдел», «Роли» (бейджи
 * `PGyPp`/`ERP/Atom/Badge`, тон `brand` — тот же, что и на карточке роли, см. `Badge.tsx`'s
 * JSDoc) и «Действия» (`qVdml`/`ERP/Atom/Icon Button`, иконка `pencil`/`user-plus`).
 *
 * ОТКЛОНЕНИЕ от макета (документировано, не решалось самостоятельно за пределами раздела 20.7 —
 * тот же приём, что и у счётчика «N сотрудников» на карточке роли, `RoleCard.tsx`): под именем
 * сотрудника в макете есть вторая строка с должностью («Генеральный директор», «Мастер приёмки»)
 * — ни `EmployeeResponse` (`GET /directory/employees`), ни любой другой доступный этой фиче
 * эндпоинт не возвращает должность сотрудника. Подпись не отображается, а не заменяется
 * выдуманным значением.
 *
 * Иконка действия по `employee.roleIds.length` (пусто -> `user-plus`, есть роль -> `pencil`,
 * дизайн `F6d3a`'s строка «Елена Соколова»/`C2s69` против остальных строк/`ZzV6g`) открывает
 * поповер со списком ролей-чекбоксов (та же механика чекбоксов, что и `RolePermissionMatrix`) —
 * назначение/снятие роли применяется сразу по клику (`onAssign`/`onRevoke` — прямые мутации
 * `useEmployeeRoleAssignment`, без промежуточного черновика/кнопки «Сохранить», в отличие от
 * `RolePermissionMatrix`: макет не даёт отдельной спецификации этого взаимодействия за пределами
 * самой иконки, чекбокс-поповер — наименее рискованный выбор, переиспользующий уже существующие
 * атомы UI Kit вместо нового компонента).
 *
 * Панель фильтров макета (`DyYbl`: чип «Отдел: Все», поиск «Поиск сотрудника») сознательно НЕ
 * реализована — раздел 20.7 tasks.md не описывает фильтрацию/поиск как часть приёмки этого
 * компонента, а сама механика чипа (открывает ли клик выбор отдела) в макете не специфицирована
 * за пределами статичного дефолтного состояния «Все».
 */
export type EmployeeRoleAssignmentProps = {
    employees: EmployeeWithRoles[]
    roles: RoleResponse[]
    onAssign: (employeeId: number, roleId: string) => void
    onRevoke: (employeeId: number, roleId: string) => void
}

function initialsOf(name: string): string {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('')
}

function roleNameOf(roles: RoleResponse[], roleId: string): string {
    return roles.find((role) => role.id === roleId)?.name ?? roleId
}

function EmployeeRoleAssignment({ employees, roles, onAssign, onRevoke }: EmployeeRoleAssignmentProps) {
    return (
        <div data-slot="employee-role-assignment" className="overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-hairline bg-canvas">
                        <th className="w-[340px] px-4 py-2.5 text-left font-ui text-xs font-semibold text-ink">
                            Сотрудник
                        </th>
                        <th className="w-[200px] px-4 py-2.5 text-left font-ui text-xs font-semibold text-ink">Отдел</th>
                        <th className="px-4 py-2.5 text-left font-ui text-xs font-semibold text-ink">Роли</th>
                        <th className="w-16 px-4 py-2.5 text-left font-ui text-xs font-semibold text-ink">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {employees.map((employee) => {
                        const hasRole = employee.roleIds.length > 0
                        return (
                            <tr key={employee.id} data-slot="employee-row" className="border-b border-hairline last:border-b-0">
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-2.5">
                                        <Avatar>
                                            <AvatarFallback>{initialsOf(employee.name)}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-ui text-[13px] font-semibold text-ink">{employee.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4 font-ui text-[13px] text-ink-muted">
                                    {employee.departmentName ?? '—'}
                                </td>
                                <td className="px-4 py-4">
                                    {hasRole ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {employee.roleIds.map((roleId) => (
                                                <Badge key={roleId}>{roleNameOf(roles, roleId)}</Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="font-ui text-[13px] text-ink-muted">Роль не назначена</span>
                                    )}
                                </td>
                                <td className="px-4 py-4">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <IconButton
                                                aria-label={
                                                    hasRole
                                                        ? `Изменить роли сотрудника ${employee.name}`
                                                        : `Назначить роль сотруднику ${employee.name}`
                                                }
                                            >
                                                {hasRole ? <Pencil /> : <UserPlus />}
                                            </IconButton>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[240px]">
                                            <div className="flex flex-col gap-2.5">
                                                {roles.map((role) => {
                                                    const checked = employee.roleIds.includes(role.id)
                                                    return (
                                                        <label
                                                            key={role.id}
                                                            className="flex items-center gap-2 font-ui text-[13px] text-ink"
                                                        >
                                                            <Checkbox
                                                                checked={checked}
                                                                aria-label={role.name}
                                                                onCheckedChange={() =>
                                                                    checked
                                                                        ? onRevoke(employee.id, role.id)
                                                                        : onAssign(employee.id, role.id)
                                                                }
                                                            />
                                                            {role.name}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export { EmployeeRoleAssignment }
