import { ConflictException } from '@/shared/exceptions';

// Неявная синхронизация ERP перед закрытием периода не удалась (ошибка
// интеграции или таймаут) — брошено ErpPeriodSyncRunner (см.
// application/services/erp-period-sync-runner.service.ts), direction-агностично:
// конструктор принимает direction параметром, класс общий для service и shop
// (Фаза 9 docs/service-shop-boundary-violations-fix — ранее физически лежал в
// domains/service/modules/accounting, хотя уже использовался обоими доменами).
export class ErpSyncFailedException extends ConflictException {
    constructor(direction: string, period: string, cause?: Error) {
        super('Не удалось получить данные из ERP, повторите позже', cause, {
            direction,
            period,
            reason: cause?.message ?? null,
        });
    }
}
