import { Inject, Injectable, Logger } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingDirection } from '@/shared/domain/calculation-context';
import { ErpSyncFailedException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { ERP_PERIOD_SYNC } from '@/domains/service/modules/accounting/application/ports/erp-period-sync.port';
import type { ErpPeriodSyncPort } from '@/domains/service/modules/accounting/application/ports/erp-period-sync.port';

// Таймаут неявной синхронизации внутри закрытия, после которого закрытие
// считается неудавшимся (PRD 1, открытые вопросы: "предварительно 2 минуты").
export const ERP_PERIOD_SYNC_TIMEOUT_MS = 2 * 60 * 1000;

// Неявная синхронизация ERP за закрываемый месяц (PRD 1
// docs/payroll-closing-and-accrual, Фаза 2) — обёртка над ErpPeriodSyncPort:
// ограничивает ожидание таймаутом и любую ошибку (интеграции или таймаут)
// превращает в ErpSyncFailedException (409, "не удалось получить данные из
// ERP"), чтобы хендлер закрытия отклонил операцию до расчёта. Синк
// выполняется ДО транзакции закрытия: его результат остаётся в БД и при
// отклонении — данные просто стали свежее. При таймауте сам синк не
// прерывается (он продолжит работу под блокировкой направления — см.
// DirectionSyncLock), но закрытие его уже не ждёт.
@Injectable()
export class ErpPeriodSyncRunner {
    private readonly logger = new Logger(ErpPeriodSyncRunner.name);

    constructor(
        @Inject(ERP_PERIOD_SYNC)
        private readonly erpSync: ErpPeriodSyncPort,
    ) {}

    async run(
        direction: AccountingDirection,
        period: Period,
        options: { timeoutMs?: number } = {},
    ): Promise<void> {
        const timeoutMs = options.timeoutMs ?? ERP_PERIOD_SYNC_TIMEOUT_MS;
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(
                () =>
                    reject(
                        new Error(
                            `Синхронизация ERP не уложилась в ${timeoutMs} мс`,
                        ),
                    ),
                timeoutMs,
            );
        });
        try {
            await Promise.race([this.erpSync.syncPeriod(period), timeout]);
        } catch (error) {
            const cause =
                error instanceof Error ? error : new Error(String(error));
            this.logger.error(
                `Синхронизация ERP направления "${direction}" за ${period.getValue()} не удалась: ${cause.message}`,
            );
            throw new ErpSyncFailedException(
                direction,
                period.getValue(),
                cause,
            );
        } finally {
            if (timer) {
                clearTimeout(timer);
            }
        }
    }
}
