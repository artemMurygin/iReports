import { useQuery } from '@tanstack/react-query'

import { tasksApi } from './api.ts'

/** Имя ответственного (`Блок · Ответственный`, фреймы `kf1uq`/`QpFcx`/`yZE5X`/`cmZjM`) —
 * `Task.assigneeEmployeeId` несёт только id (design.md решение 2: задача не хранит ничего кроме
 * ссылки), имя резолвится отдельным запросом к справочнику сотрудников. `undefined`, пока
 * справочник ещё грузится или сотрудник не нашёлся — вызывающий код в этом случае показывает id. */
export function useAssigneeName(assigneeEmployeeId: number): string | undefined {
    const { data: employees } = useQuery(tasksApi.getAssigneeEmployees())
    return employees?.find((e) => e.id === assigneeEmployeeId)?.name
}
