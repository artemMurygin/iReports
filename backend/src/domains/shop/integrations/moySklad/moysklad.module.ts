import { Module } from '@nestjs/common';
import { MoyskladService } from './moysklad.service';
import { MoyskladHttpService } from './moysklad.instance';

@Module({
    controllers: [],
    providers: [MoyskladHttpService, MoyskladService],
    // MoyskladHttpService экспортирован отдельно от MoyskladService (Фаза 11
    // PRD 3, docs/payroll-closing-and-accrual) — MoyskladCashDocumentAdapter
    // (domains/shop/integrations/moySklad/moysklad-cash-document.adapter.ts)
    // ходит в /entity/cashout|cashin напрямую через axios-обёртку, тем же
    // приёмом, что MoyskladService, а не через доменные fetch*-методы
    // последнего (их там просто нет для кассовых документов).
    exports: [MoyskladService, MoyskladHttpService],
})
export class MoyskladModule {}
