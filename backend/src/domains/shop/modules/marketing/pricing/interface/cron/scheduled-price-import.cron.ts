import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from 'nestjs-request-context';
import { ProdCron } from '@/shared/cron/prod-cron.decorator';
import { toError } from '@/shared/logger/to-error';
import { RunScheduledPriceImportService } from '../../application/services/run-scheduled-price-import.service';

// Будни в 12:00 по Москве (spec: shop/price-import-schedule#расписание-запуска).
// Крон выполняется вне HTTP-запроса, а ExceptionBase/Command в конструкторе читают
// request context — поэтому запускаем сервис внутри собственного RequestContext.
@Injectable()
export class ScheduledPriceImportCron {
    private readonly logger = new Logger(ScheduledPriceImportCron.name);

    constructor(private readonly service: RunScheduledPriceImportService) {}

    @ProdCron('0 12 * * 1-5', { timeZone: 'Europe/Moscow' })
    async run(): Promise<void> {
        try {
            await RequestContext.cls.run(
                new RequestContext({ body: {} } as never, {} as never),
                () => this.service.run(),
            );
        } catch (error) {
            this.logger.error(
                { err: toError(error) },
                'Крон автоматической выгрузки прайса упал',
            );
        }
    }
}
