import { Module } from '@nestjs/common';

// Сквозной модуль сессионного слоя (add-bitrix24-auth-and-rbac) — владеет
// Redis-сессиями (design.md, Decision 1). Живёт вне domains/{service,shop},
// по аналогии с src/modules/employee-identity. Наполняется по мере
// прохождения tasks.md (разделы 2, 7).
@Module({})
export class SessionModule {}
