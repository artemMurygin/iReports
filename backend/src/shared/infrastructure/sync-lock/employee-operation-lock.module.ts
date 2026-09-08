import { Module } from '@nestjs/common';
import { EmployeeOperationLock } from './employee-operation-lock';

// Общий модуль (не @Global — импортируется явно, тот же приём, что
// DirectionSyncLockModule): будущие обработчики выплаты/удаления выплаты в
// domains/service и domains/shop (Фаза 12, следующие агенты) берут из него
// один и тот же экземпляр EmployeeOperationLock.
@Module({
    providers: [EmployeeOperationLock],
    exports: [EmployeeOperationLock],
})
export class EmployeeOperationLockModule {}
