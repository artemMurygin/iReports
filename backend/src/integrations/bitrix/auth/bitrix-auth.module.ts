import { Module } from '@nestjs/common';
import { BitrixPortalAdminCheckService } from './portal-admin-check.service';
import { PortalAdminGuard } from './portal-admin.guard';

// Выделен из BitrixModule намеренно: потребителям гарда (например,
// EmployeeIdentityModule) не нужны BitrixController/BitrixService —
// синхронизация сделок и вебхук установки приложения им не сдались, а
// тянуть их только ради PortalAdminGuard раздувало бы граф модулей.
@Module({
    providers: [BitrixPortalAdminCheckService, PortalAdminGuard],
    exports: [BitrixPortalAdminCheckService, PortalAdminGuard],
})
export class BitrixAuthModule {}
