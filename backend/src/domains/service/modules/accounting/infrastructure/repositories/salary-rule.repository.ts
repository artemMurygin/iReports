import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalaryRuleMapper } from '../mappers/salary-rule.mapper';

@Injectable()
export class SalaryRuleRepository
    extends PrismaRepository
    implements SalaryRuleRepositoryPort
{
    private readonly mapper = new SalaryRuleMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(
        entity: SalaryRule,
        meta: { motivationSchemaId: string },
    ): Promise<void> {
        await this.write(entity, (client) =>
            client.salaryRule.create({
                data: {
                    ...this.mapper.toPersistence(entity),
                    motivationSchemaId: meta.motivationSchemaId,
                },
            }),
        );
    }
}
