import { Cron } from '@nestjs/schedule';
import type { CronOptions } from '@nestjs/schedule';

export function ProdCron(
    cronExpression: string,
    options?: CronOptions,
): MethodDecorator {
    if (process.env.ENABLE_CRON !== 'true') {
        return () => {};
    }
    return Cron(cronExpression, options);
}
