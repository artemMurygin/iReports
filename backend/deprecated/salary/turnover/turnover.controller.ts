import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

class TurnoverQueryDto extends createZodDto(
  z.object({
    period: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Период должен быть в формате YYYY-MM'),
  }),
) {}

// Заглушка: остатков МойСклад пока нет (ARCHITECTURE.md §7.1) — до интеграции
// ветка всегда отвечает "нет данных", не выдавая себя за реальный расчёт.
@Controller('turnover')
export class TurnoverController {
  @Get()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  get(@Query() { period }: TurnoverQueryDto) {
    return {
      status: 'NO_DATA',
      period,
      message:
        'Оборачиваемость не рассчитывается: нет интеграции с остатками МойСклад (turnover_snapshots пуст).',
    };
  }
}
