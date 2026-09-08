import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RoappGatewayModule } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.module';
import { UpdateServicePricesHandler } from './application/command/update-service-prices.handler';
import { UpdateServicePricesHttpController } from './interface/http-controllers/update-service-prices.http.controller';

// Саб-группа marketing домена service (Фаза 7, см. domains/service/CLAUDE.md,
// раздел "Целевой набор модулей домена") — на сегодня единственный модуль
// внутри неё. Никакой собственной инфраструктуры/репозиториев: вся работа —
// синхронная операция поверх RoappGateway (RoappGatewayModule экспортирует
// ROAPP_GATEWAY), без Prisma-состояния.
@Module({
    imports: [CqrsModule, RoappGatewayModule],
    controllers: [UpdateServicePricesHttpController],
    providers: [UpdateServicePricesHandler],
})
export class PricingModule {}
