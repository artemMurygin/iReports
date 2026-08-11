import { Module } from '@nestjs/common';
import { MoyskladModule } from '../../integrations/moySklad/moysklad.module';
import { MoySkladSyncService } from './moysklad-sync.service';
import { MoySkladSyncCron } from './moysklad-sync.cron';
import { ProductFolderTreeService } from './product-folder-tree.service';

@Module({
    imports: [MoyskladModule],
    providers: [
        MoySkladSyncService,
        MoySkladSyncCron,
        ProductFolderTreeService,
    ],
    exports: [ProductFolderTreeService],
})
export class MoySkladSyncModule {}
