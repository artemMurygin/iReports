import { Injectable } from '@nestjs/common';
import type {
    ErpCashConfig,
    ErpCashConfigRepositoryPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash/erp-cash-config.port';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { serviceErpCashConfig } from '@/domains/service/modules/accounting/config/erp-cash.config';
import { ArgumentInvalidException } from '@/shared/exceptions';

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
// фазы у shop собственный, независимый ShopCashboxConfigRepository
// (domains/shop/modules/accounting/infrastructure/repositories/cashbox-config.repository.ts)
// под собственным токеном SHOP_ERP_CASH_CONFIG_REPOSITORY — ни
// RoappCashDocumentAdapter (всегда 'service'), ни GetErpCashConfigService
// (используется только сервисным GetErpCashConfigHttpController) сюда
// direction: 'shop' больше не передают, поэтому ветка возвращает null (тот
// же приём null-safety, что и раньше — «направление не сконфигурировано»,
// см. ErpCashConfigRepositoryPort).
//
// Валидация формата ID (ниже) — перенесена сюда из validate() бывшей
// доменной сущности ErpCashConfig при выносе конфигурации из domain/entities
// (она никогда не была бизнес-инвариантом уровня агрегата — сущности не за
// что было отвечать как root'у, у неё нет ни дочерних объектов, ни
// консистентности между несколькими из них, только чтение значения из
// .env): fail fast с понятной ошибкой, если ROAPP_CASHBOX_ID/
// ROAPP_CATEGORY_ID заданы, но не являются положительным целым числом
// (Number(process.env.X) может дать NaN/дробное/отрицательное значение),
// вместо непонятного 400 от RemOnline при первом реальном вызове.
function assertPositiveIntegerOrNull(
    value: number | null,
    label: string,
): void {
    if (value !== null && (!Number.isInteger(value) || value <= 0)) {
        throw new ArgumentInvalidException(
            `${label} должен быть положительным целым числом`,
        );
    }
}

@Injectable()
export class ErpCashConfigProvider implements ErpCashConfigRepositoryPort {
    findByDirection(
        direction: AccountingDirection,
    ): Promise<ErpCashConfig | null> {
        if (direction !== 'service') {
            return Promise.resolve(null);
        }
        assertPositiveIntegerOrNull(
            serviceErpCashConfig.roappCashboxId,
            'ID кассы RemOnline (ROAPP_CASHBOX_ID)',
        );
        assertPositiveIntegerOrNull(
            serviceErpCashConfig.roappCategoryId,
            'ID статьи движения денег RemOnline (ROAPP_CATEGORY_ID)',
        );
        return Promise.resolve({
            direction: 'service',
            roappCashboxId: serviceErpCashConfig.roappCashboxId,
            roappCategoryId: serviceErpCashConfig.roappCategoryId,
            moySkladExpenseItemId: null,
            moySkladIncomeItemId: null,
            organizationId: null,
        });
    }
}
