import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { DealCatalogReaderPort } from '@/domains/service/modules/sales/application/ports/deal-catalog.port';
import { DealListStage } from '@/domains/service/modules/sales/domain/value-objects/deal-list-stage.value-object';
import { DealAssignee } from '@/domains/service/modules/sales/domain/value-objects/deal-assignee.value-object';
import { DealLeadSource } from '@/domains/service/modules/sales/domain/value-objects/deal-lead-source.value-object';
import { DealDeviceType } from '@/domains/service/modules/sales/domain/value-objects/deal-device-type.value-object';
import { DealStageGroup } from '@/domains/service/modules/sales/domain/value-objects/deal-stage-group.value-object';

// Реализация DealCatalogReaderPort — воспроизводит РОВНО ту же Prisma-
// семантику пяти getX-методов легаси DealsService
// (src/TODO/deals/deals.service.ts): те же where/select/distinct/orderBy,
// кроме findManagers. Легаси getDealsManagers() делает один
// bitrixEmployee.findFirst на каждый distinct assignedById (N+1); здесь —
// один батч-запрос bitrixEmployee.findMany({ where: { id: { in: [...] } } })
// (тот же приём, что MotivationSchemaRepository.findByEmployees, см.
// accounting/infrastructure/repositories/motivation-schema.repository.ts).
// Побочный эффект батч-варианта: employeeId без соответствующей строки
// bitrixEmployee просто отсутствует в результате, а не превращается в null
// (как мог бы, гипотетически, findFirst) — для реальных данных (FK всегда
// валиден) расхождения нет, см. deal-catalog.repository.spec.ts.
@Injectable()
export class DealCatalogRepository
    extends PrismaRepository
    implements DealCatalogReaderPort
{
    constructor(db: DatabaseService) {
        super(db);
    }

    async findStages(): Promise<DealListStage[]> {
        const stages = await this.client.bitrixStage.findMany({
            where: { entityId: 'DEAL_STAGE' },
        });
        return stages
            .toSorted((a, b) => a.sort - b.sort)
            .map(
                (stage) =>
                    new DealListStage({
                        id: stage.id,
                        name: stage.name,
                        sort: stage.sort,
                        color: stage.color,
                        systemType: stage.systemType,
                        stageGroupId: stage.stageGroupId,
                        stageGroupName: stage.stageGroupName,
                    }),
            );
    }

    async findDeviceTypes(): Promise<DealDeviceType[]> {
        const deviceTypes = await this.client.bitrixDeviceTypes.findMany();
        return deviceTypes.map(
            (deviceType) =>
                new DealDeviceType({
                    id: deviceType.id,
                    name: deviceType.name,
                }),
        );
    }

    async findManagers(): Promise<DealAssignee[]> {
        const assignedDeals = await this.client.bitrixDeal.findMany({
            select: { assignedById: true },
            distinct: ['assignedById'],
            where: { assignedById: { not: null } },
        });
        const managerIds = assignedDeals
            .map((deal) => deal.assignedById)
            .filter((id): id is number => id !== null);

        if (managerIds.length === 0) {
            return [];
        }

        const employees = await this.client.bitrixEmployee.findMany({
            where: { id: { in: managerIds } },
        });
        return employees.map(
            (employee) =>
                new DealAssignee({
                    id: employee.id,
                    firstName: employee.firstName,
                    lastName: employee.lastName,
                }),
        );
    }

    async findSources(): Promise<DealLeadSource[]> {
        const sources = await this.client.bitrixLeadSources.findMany();
        return sources.map(
            (source) =>
                new DealLeadSource({ id: source.id, name: source.name }),
        );
    }

    async findStageGroups(): Promise<DealStageGroup[]> {
        const stages = await this.client.bitrixStage.findMany({
            where: {
                entityId: 'DEAL_STAGE',
                stageGroupId: { not: null },
            },
            select: { stageGroupId: true, stageGroupName: true },
            distinct: ['stageGroupId'],
        });

        return stages
            .filter(
                (
                    stage,
                ): stage is {
                    stageGroupId: string;
                    stageGroupName: string;
                } =>
                    stage.stageGroupId !== null &&
                    stage.stageGroupName !== null,
            )
            .map(
                (stage) =>
                    new DealStageGroup({
                        id: stage.stageGroupId,
                        name: stage.stageGroupName,
                    }),
            );
    }
}
