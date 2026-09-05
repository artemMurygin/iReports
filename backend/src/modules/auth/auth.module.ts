import { Module } from '@nestjs/common';

// Сквозной модуль аутентификации (add-bitrix24-auth-and-rbac) — владеет
// токенами Bitrix24 конкретного сотрудника, оркестрирует вход (design.md,
// Decision 1). НЕ владеет идентичностью — она уже есть (BitrixEmployee).
// Живёт вне domains/{service,shop}, по аналогии с
// src/modules/employee-identity. Наполняется по мере прохождения
// tasks.md (разделы 2, 4, 5, 6, 11).
@Module({})
export class AuthModule {}
