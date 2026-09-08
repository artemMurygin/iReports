import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ShopAccountingPeriodClosedDomainEvent } from '@/domains/shop/modules/accounting/domain/events/accounting-period-closed.domain-event';
import { Period } from '@/shared/domain/period.value-object';
import { RebuildGoodsTurnoverReportService } from '@/domains/shop/modules/warehouse/application/services/goods-turnover-report/rebuild-goods-turnover-report.service';

// design.md D9: закрытие расчётного периода направления «Магазин»
// (ShopAccountingPeriod) фиксирует отчёт по оборачиваемости этого месяца
// как неизменяемый снэпшот — тот же RebuildGoodsTurnoverReportService.rebuild,
// что и почасовой GoodsTurnoverReportCron, но по данным на момент закрытия;
// после этого часовой крон для этого периода больше не пересчитывает его
// (findByPeriod вернёт закрытую запись). У отчёта нет собственного действия
// «закрыть» — фиксация происходит только через это событие.
//
// Ошибка пересчёта здесь намеренно не пробрасывается наружу: событие
// публикуется уже ПОСЛЕ коммита транзакции закрытия периода (см.
// DatabaseService.withTransaction) — сам факт закрытия периода уже
// свершился и не должен откатываться/казаться неуспешным из-за сбоя
// побочного пересчёта отчёта; следующий тик GoodsTurnoverReportCron всё
// равно не подхватит это (период уже закрыт), поэтому сбой здесь только
// логируется для ручного разбора.
@Injectable()
export class GoodsTurnoverPeriodClosedHandler {
    private readonly logger = new Logger(GoodsTurnoverPeriodClosedHandler.name);

    constructor(
        private readonly rebuildReport: RebuildGoodsTurnoverReportService,
    ) {}

    @OnEvent('ShopAccountingPeriodClosedDomainEvent')
    async handle(event: ShopAccountingPeriodClosedDomainEvent): Promise<void> {
        try {
            await this.rebuildReport.rebuild(Period.create(event.period));
            this.logger.log(
                `Отчёт по оборачиваемости зафиксирован как снэпшот при закрытии периода ${event.period}`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Не удалось зафиксировать снэпшот отчёта по оборачиваемости при закрытии периода ${event.period}: ${message}`,
            );
        }
    }
}
