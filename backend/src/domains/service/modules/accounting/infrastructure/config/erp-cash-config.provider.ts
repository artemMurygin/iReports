import { Injectable } from '@nestjs/common';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import { ErpCashConfigRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { serviceErpCashConfig } from '@/domains/service/modules/accounting/config/erp-cash.config';

// Реализация ErpCashConfigRepositoryPort поверх файлового конфига модуля
// (env-переменные, см. config/erp-cash.config.ts), а не БД — правка
// пользователя от 2026-08-24 (см. заметку в конце Фазы 11
// docs/payroll-closing-and-accrual/plan-payroll-closing-and-accrual.md):
// изначально (Фаза 11) это был Prisma-репозиторий поверх модели
// ErpCashConfig, редактируемой через PUT /v1/{direction}/accounting/
// erp_cash_config; PUT убран, значения теперь задаются только через .env и
// требуют перезапуска процесса, чтобы применились.
//
// Физически определён в domains/service, обслуживает только direction =
// 'service' — до Фазы 4 docs/service-shop-boundary-violations-fix этот же
// класс отвечал и за 'shop' (импортируя shopErpCashConfig из domains/shop
// напрямую, §2.2 docs/service-shop-boundary-violations.md, "Service → Shop",
// обратное направление цикла с Shop.moysklad-cash-document.adapter). С этой
// фазы у shop собственный, независимый ShopErpCashConfigProvider
// (domains/shop/modules/accounting/infrastructure/config/shop-erp-cash-config.provider.ts)
// под собственным токеном SHOP_ERP_CASH_CONFIG_REPOSITORY — ни
// RoappCashDocumentAdapter (всегда 'service'), ни GetErpCashConfigService
// (используется только сервисным GetErpCashConfigHttpController) сюда
// direction: 'shop' больше не передают, поэтому ветка возвращает null (тот
// же приём null-safety, что и раньше — «направление не сконфигурировано»,
// см. ErpCashConfigRepositoryPort).
@Injectable()
export class ErpCashConfigProvider implements ErpCashConfigRepositoryPort {
    findByDirection(
        direction: AccountingDirection,
    ): Promise<ErpCashConfig | null> {
        if (direction !== 'service') {
            return Promise.resolve(null);
        }
        return Promise.resolve(
            ErpCashConfig.create({
                direction: 'service',
                roappCashboxId: serviceErpCashConfig.roappCashboxId,
                roappCategoryId: serviceErpCashConfig.roappCategoryId,
            }),
        );
    }
}
