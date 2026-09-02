import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { SalaryRuleMapper } from '../../mappers/motivation-schema/salary-rule.mapper';

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

    async deleteAllByMotivationSchema(
        motivationSchemaId: string,
    ): Promise<void> {
        // direction: 'service' в WHERE — критично: не задевает правила
        // направления shop той же строки motivation_schemas (сотрудник с
        // идентичностями в обеих ERP), см. комментарий у
        // SalaryRuleRepositoryPort.deleteAllByMotivationSchema.
        await this.write(null, (client) =>
            client.salaryRule.deleteMany({
                where: { motivationSchemaId, direction: 'service' },
            }),
        );
    }

    async findById(id: string): Promise<SalaryRule | null> {
        const record = await this.client.salaryRule.findFirst({
            where: { id, direction: 'service' },
        });
        return record ? this.mapper.toDomain(record) : null;
    }

    async update(entity: SalaryRule): Promise<void> {
        await this.write(entity, (client) =>
            client.salaryRule.update({
                where: { id: entity.id },
                data: { props: this.mapper.toPersistence(entity).props },
            }),
        );
    }
}
