import { Module } from '@nestjs/common';
import { MoyskladModule } from '../../integrations/moySklad/moysklad.module';
import { DirectionSyncLockModule } from '@/shared/infrastructure/sync-lock/direction-sync-lock.module';
import { MoySkladSyncService } from './moysklad-sync.service';
import { MoySkladSyncCron } from './moysklad-sync.cron';
import { ProductFolderTreeService } from './product-folder-tree.service';

@Module({
    imports: [MoyskladModule, DirectionSyncLockModule],
    providers: [
        MoySkladSyncService,
        MoySkladSyncCron,
        ProductFolderTreeService,
    ],
    // MoySkladSyncService и DirectionSyncLockModule — для
    // MoySkladErpPeriodSyncAdapter (ShopAccountingModule): синк месяца по
    // требованию из закрытия периода тем же сервисом и под той же
    // блокировкой направления, что и крон.
    exports: [
        ProductFolderTreeService,
        MoySkladSyncService,
        DirectionSyncLockModule,
    ],
})
export class MoySkladSyncModule {}
