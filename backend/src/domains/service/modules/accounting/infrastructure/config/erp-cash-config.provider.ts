import { Injectable } from '@nestjs/common';
import { ErpCashConfig } from '@/domains/service/modules/accounting/domain/entities/erp-cash-config.entity';
import { ErpCashConfigRepositoryPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-config.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { serviceErpCashConfig } from '@/domains/service/modules/accounting/config/erp-cash.config';
import { shopErpCashConfig } from '@/domains/shop/modules/accounting/config/erp-cash.config';

// Реализация ErpCashConfigRepositoryPort поверх файлового конфига модуля
// (env-переменные, см. config/erp-cash.config.ts обоих доменов), а не БД —
// правка пользователя от 2026-08-24 (см. заметку в конце Фазы 11
// docs/payroll-closing-and-accrual/plan-payroll-closing-and-accrual.md):
// изначально (Фаза 11) это был Prisma-репозиторий поверх модели
// ErpCashConfig, редактируемой через PUT /v1/{direction}/accounting/
// erp_cash_config; PUT убран, значения теперь задаются только через .env и
// требуют перезапуска процесса, чтобы применились. Порт остался прежним
// (только findByDirection — save() убран вместе с PUT), поэтому
// GetErpCashConfigService и cash-document адаптеры (RoappCashDocumentAdapter/
// MoyskladCashDocumentAdapter) не менялись — только DI-провайдер в
// accounting.module.ts/shop-accounting.module.ts.
//
// Физически определён в domains/service вместе с остальным ErpCashConfig
// (та же интеграция, что документирует erp-cash-config.port.ts), поэтому
// импортирует shopErpCashConfig из domains/shop напрямую — это тот же
// осознанный кросс-доменный приём, что уже применён к самому порту/сущности/
// GetErpCashConfigService, не новое исключение.
@Injectable()
export class ErpCashConfigProvider implements ErpCashConfigRepositoryPort {
    findByDirection(
        direction: AccountingDirection,
    ): Promise<ErpCashConfig | null> {
        if (direction === 'service') {
            return Promise.resolve(
                ErpCashConfig.create({
                    direction: 'service',
                    roappCashboxId: serviceErpCashConfig.roappCashboxId,
                    roappCategoryId: serviceErpCashConfig.roappCategoryId,
                }),
            );
        }
        return Promise.resolve(
            ErpCashConfig.create({
                direction: 'shop',
                moySkladExpenseItemId: shopErpCashConfig.moySkladExpenseItemId,
                moySkladIncomeItemId: shopErpCashConfig.moySkladIncomeItemId,
                organizationId: shopErpCashConfig.organizationId,
            }),
        );
    }
}
