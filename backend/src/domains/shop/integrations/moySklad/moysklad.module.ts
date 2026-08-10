import { Module } from '@nestjs/common';
import { MoyskladService } from './moysklad.service';
import { MoyskladHttpService } from './moysklad.instance';

@Module({
    controllers: [],
    providers: [MoyskladHttpService, MoyskladService],
    exports: [MoyskladService],
})
export class MoyskladModule {}
