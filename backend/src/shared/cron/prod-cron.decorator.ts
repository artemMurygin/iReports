import { Cron } from '@nestjs/schedule';

export function ProdCron(cronExpression: string): MethodDecorator {
  if (process.env.ENABLE_CRON !== 'true') {
    return () => {};
  }
  return Cron(cronExpression);
}
