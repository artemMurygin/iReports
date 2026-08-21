import { Module } from '@nestjs/common';
import { DirectionSyncLock } from './direction-sync-lock';

// Общий модуль (не @Global — импортируется явно): RoappSyncModule и
// MoySkladSyncModule берут из него один и тот же экземпляр DirectionSyncLock
// для крона и для синка по требованию из закрытия периода.
@Module({
    providers: [DirectionSyncLock],
    exports: [DirectionSyncLock],
})
export class DirectionSyncLockModule {}
