import type { EmployeeResponse } from 'ireports-contracts';
import type { EmployeeSummary } from '../ports/directory.port';

// firstName + lastName собираются в одно отображаемое имя на бэкенде — тот
// же порядок, что уже принят на фронтенде для сотрудника (см.
// frontend/src/features/DealsByManagerChart/model/useManagerStats.ts,
// `${firstName} ${lastName}`), чтобы фронтенду не пришлось знать про
// разбиение имени.
export function toEmployeeResponse(
    employee: EmployeeSummary,
): EmployeeResponse {
    return {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        departmentId: employee.departmentId,
    };
}
