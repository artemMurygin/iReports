import type { EmployeeWithServiceAccountResponse } from 'ireports-contracts';
import type { EmployeeSummary } from '../ports/directory.port';

// Тот же приём сборки имени, что и в to-employee-response.ts, плюс
// isServiceAccount — только этот эндпоинт (PATCH .../employees/:id/service-
// account) отдаёт признак наружу, поэтому мапится отдельной функцией, а не
// расширением toEmployeeResponse.
export function toEmployeeWithServiceAccountResponse(
    employee: EmployeeSummary,
): EmployeeWithServiceAccountResponse {
    return {
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        departmentId: employee.departmentId,
        // DirectoryRepository.setServiceAccount всегда выбирает поле в
        // select — non-null здесь гарантирован реальной реализацией порта;
        // ?? false — только защита от фейков, где поле не заполнено.
        isServiceAccount: employee.isServiceAccount ?? false,
    };
}
