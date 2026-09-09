import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { getErrorMessage } from '@/shared/utils/getErrorMessage';
import { AccountingPeriodClosedDomainEvent } from '@/domains/service/modules/accounting/domain/events/accounting-period-closed.domain-event';
import { GOODS_TURNOVER_REPORT_LINE_REPOSITORY } from '../ports/goods-turnover-report/goods-turnover-report-line.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '../ports/goods-turnover-report/goods-turnover-report-line.port';
import { BuildGoodsTurnoverReportService } from '../services/build-goods-turnover-report.service';

// design.md D7: у отчёта по оборачиваемости нет собственной команды/статуса
// закрытия периода (см. D5) — статус целиком определяется зарплатным
// AccountingPeriod. Подписывается на уже существующее
// AccountingPeriodClosedDomainEvent (как соседний лог-хендлер в
// modules/accounting) и реагирует только когда direction === 'service'
// (событие с direction: 'shop' игнорируется — у этого change нет
// направления shop). Делает финальный пересчёт по актуальным данным (тот
// же путь, что и почасовой крон, задача 11/design.md D4/D6) и сохраняет
// пересчитанные строки как снэпшот — чтобы зафиксированный отчёт отражал
// самые свежие данные на момент закрытия, а не устаревшие с последнего
// часового тика.
//
// Переоткрытие AccountingPeriod отдельного обработчика не имеет —
// design.md Open Questions: ReopenAccountingPeriodHandler не публикует
// событие, часовой крон (задача 11) сам возобновит пересчёт открытого
// периода в течение часа после переоткрытия.
//
// design.md Risks: обработчик — асинхронный подписчик (EventEmitter2,
// emitAsync), публикуется уже после коммита транзакции закрытия зарплатного
// периода (см. AggregateRoot.publishEvents/DatabaseService.withTransaction)
// — не удлиняет и не может откатить эту транзакцию; собственная запись
// строк идёт отдельной операцией. Сбой финального пересчёта не должен
// ронять обработку события целиком — логируется, а не выбрасывается.
@Injectable()
export class CloseGoodsTurnoverPeriod {
    private readonly logger = new Logger(CloseGoodsTurnoverPeriod.name);

    constructor(
        private readonly buildReport: BuildGoodsTurnoverReportService,
        @Inject(GOODS_TURNOVER_REPORT_LINE_REPOSITORY)
        private readonly lineRepository: GoodsTurnoverReportLineRepositoryPort,
    ) {}

    @OnEvent('AccountingPeriodClosedDomainEvent')
    async handle(event: AccountingPeriodClosedDomainEvent): Promise<void> {
        if (event.direction !== 'service') {
            return;
        }

        try {
            const report = await this.buildReport.build(event.period);
            await this.lineRepository.replaceAll(event.period, report.lines);
            this.logger.log(
                `Оборачиваемость за ${event.period} зафиксирована финальным пересчётом при закрытии периода: ${report.lines.length} строк`,
            );
        } catch (error) {
            this.logger.error(
                `Не удалось зафиксировать оборачиваемость за ${event.period} при закрытии периода: ${getErrorMessage(error)}`,
            );
        }
    }
}
