import { Module } from '@nestjs/common';
import { LEAD_REPOSITORY } from './domain/ports/sales.repositories.port';
import { LeadRepository } from './infrastructure/sales.repositories';

@Module({
  providers: [{ provide: LEAD_REPOSITORY, useClass: LeadRepository }],
  exports: [LEAD_REPOSITORY],
})
export class SalesModule {}
