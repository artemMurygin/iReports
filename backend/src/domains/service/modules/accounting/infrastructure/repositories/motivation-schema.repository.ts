import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { MotivationSchemaMapper } from '../mappers/motivation-schema.mapper';

@Injectable()
export class MotivationSchemaRepository
    extends PrismaRepository
    implements MotivationSchemaRepositoryPort
{
    private readonly mapper = new MotivationSchemaMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: MotivationSchema): Promise<void> {
        // write() сам оборачивает запись в транзакцию (даже одиночную) и
        // после коммита опубликует MotivationSchemaCreatedDomainEvent,
        // накопленный на entity в MotivationSchema.create().
        await this.write(entity, (client) =>
            client.motivationSchema.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async findByEmployee(employeeId: number): Promise<MotivationSchema | null> {
        // Чтение, а не запись — идёт через this.client (подхватывает
        // открытую транзакцию, если есть), а не через write().
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType: 'Employee', targetId: employeeId },
            // direction: 'service' — MotivationSchema сотрудника может
            // содержать правила ОБОИХ направлений (сотрудник числится и в
            // RemOnline, и в МойСклад, см. Фаза 2/EmployeeIdentity), а
            // `type` правил у двух направлений пересекается буквально
            // ('PayPerHour' есть и там, и там) — без этого фильтра
            // SalaryRuleMapper.toDomain мог бы получить чужую (shop)
            // строку и попытаться резолвнуть её несуществующим для этого
            // реестра типом. См. комментарий у SalaryRule.direction в
            // salary.prisma (Фаза 12).
            include: { rules: { where: { direction: 'service' } } },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findByDepartment(
        departmentId: number,
    ): Promise<MotivationSchema | null> {
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType: 'Department', targetId: departmentId },
            // direction: 'service' — см. комментарий у findByEmployee выше.
            include: { rules: { where: { direction: 'service' } } },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findAllEmployeeTargets(): Promise<MotivationSchema[]> {
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Employee' },
            // direction: 'service' — MotivationSchema сотрудника может
            // содержать правила ОБОИХ направлений (сотрудник числится и в
            // RemOnline, и в МойСклад, см. Фаза 2/EmployeeIdentity), а
            // `type` правил у двух направлений пересекается буквально
            // ('PayPerHour' есть и там, и там) — без этого фильтра
            // SalaryRuleMapper.toDomain мог бы получить чужую (shop)
            // строку и попытаться резолвнуть её несуществующим для этого
            // реестра типом. См. комментарий у SalaryRule.direction в
            // salary.prisma (Фаза 12).
            include: { rules: { where: { direction: 'service' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async findAllDepartmentTargets(): Promise<MotivationSchema[]> {
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Department' },
            // direction: 'service' — см. комментарий у findByEmployee выше.
            include: { rules: { where: { direction: 'service' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByEmployees(employeeIds: number[]): Promise<MotivationSchema[]> {
        if (employeeIds.length === 0) {
            return [];
        }
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Employee', targetId: { in: employeeIds } },
            // direction: 'service' — MotivationSchema сотрудника может
            // содержать правила ОБОИХ направлений (сотрудник числится и в
            // RemOnline, и в МойСклад, см. Фаза 2/EmployeeIdentity), а
            // `type` правил у двух направлений пересекается буквально
            // ('PayPerHour' есть и там, и там) — без этого фильтра
            // SalaryRuleMapper.toDomain мог бы получить чужую (shop)
            // строку и попытаться резолвнуть её несуществующим для этого
            // реестра типом. См. комментарий у SalaryRule.direction в
            // salary.prisma (Фаза 12).
            include: { rules: { where: { direction: 'service' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async findIdByTarget(
        targetType: string,
        targetId: number,
    ): Promise<string | null> {
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType, targetId },
            select: { id: true },
        });

        return record?.id ?? null;
    }

    async findById(id: string): Promise<MotivationSchema | null> {
        const record = await this.client.motivationSchema.findUnique({
            where: { id },
            // direction: 'service' — см. комментарий у findByEmployee выше.
            include: { rules: { where: { direction: 'service' } } },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findAll(filters: {
        targetType?: string;
        targetId?: number;
        search?: string;
    }): Promise<MotivationSchema[]> {
        const records = await this.client.motivationSchema.findMany({
            where: {
                targetType: filters.targetType,
                targetId: filters.targetId,
                name: filters.search
                    ? { contains: filters.search, mode: 'insensitive' }
                    : undefined,
            },
            // direction: 'service' — см. комментарий у findByEmployee выше.
            // Схемы, у которых после этого фильтра 0 правил, отбрасывает
            // вызывающий сервис (ListMotivationSchemasService), а не
            // репозиторий — та же граница ответственности, что и у
            // GetMotivationSchemaService/findById.
            include: { rules: { where: { direction: 'service' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async update(entity: MotivationSchema): Promise<void> {
        const props = entity.getProps();
        // Только имя — targetType/targetId неизменны после создания (нет
        // сценария "перенести схему на другую цель"), а rules персистятся
        // отдельно (SalaryRuleRepository.deleteAllByMotivationSchema +
        // CreateSalaryRuleCommand на каждое новое правило, см.
        // UpdateMotivationSchemaHandler).
        await this.write(entity, (client) =>
            client.motivationSchema.update({
                where: { id: props.id },
                data: { name: props.name },
            }),
        );
    }
}
