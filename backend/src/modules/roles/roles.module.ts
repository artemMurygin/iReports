import { Module } from '@nestjs/common';

// Сквозной модуль ролей/прав (add-bitrix24-auth-and-rbac) — владеет
// Role/Permission, guard'ами (PermissionsGuard), админ-API (design.md,
// Decision 1). Живёт вне domains/{service,shop}, по аналогии с
// src/modules/employee-identity. Наполняется по мере прохождения
// tasks.md (разделы 2, 3, 8, 9, 10, 11).
@Module({})
export class RolesModule {}
