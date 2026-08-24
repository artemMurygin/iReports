import { Module } from '@nestjs/common';
import { RoappService } from './roapp.service';
import { RoappHttpService } from './roapp.instace';
import { RoappController } from './roapp.controller';

@Module({
    controllers: [RoappController],
    providers: [RoappHttpService, RoappService],
    // RoappHttpService экспортирован дополнительно к RoappService: нужен
    // RoappCashDocumentAdapter (AccountingModule, PRD 3 Фаза 11), которому
    // не подходит ни один существующий метод RoappService — работа с
    // финансовыми транзакциями кассы, а не с каталогами/заказами.
    exports: [RoappService, RoappHttpService],
})
export class RoappModule {}
