import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { MotivationSchemaMapper } from '../../mappers/motivation-schema/motivation-schema.mapper';

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
                // Поиск идёт по serviceName (реальное отображаемое имя для
                // этого направления), а не по общей legacy-колонке `name` —
                // после PATCH одного направления она перестаёт совпадать с
                // именем, которое видит пользователь (см. комментарий у
                // serviceName в salary.prisma). Вторая ветка OR — фолбэк на
                // `name` для строк, у которых serviceName ещё NULL (до
                // миграции/до первого create-запроса со стороны service),
                // тот же приём, что и в MotivationSchemaMapper.toDomain.
                ...(filters.search
                    ? {
                          OR: [
                              {
                                  serviceName: {
                                      contains: filters.search,
                                      mode: 'insensitive' as const,
                                  },
                              },
                              {
                                  serviceName: null,
                                  name: {
                                      contains: filters.search,
                                      mode: 'insensitive' as const,
                                  },
                              },
                          ],
                      }
                    : {}),
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
        // UpdateMotivationSchemaHandler). Пишет ТОЛЬКО serviceName — общая
        // с shop-направлением колонка `name` больше не трогается этим
        // методом (кросс-направленческий баг переименования, см.
        // комментарий у serviceName в salary.prisma).
        await this.write(entity, (client) =>
            client.motivationSchema.update({
                where: { id: props.id },
                data: { serviceName: props.name },
            }),
        );
    }

    async initializeName(id: string, name: string): Promise<void> {
        // updateMany с условием serviceName: null в where — атомарная
        // "установить, только если ещё не установлено": повторный
        // create-запрос со стороны service на уже существующую (созданную
        // shop-стороной) строку не переименовывает её, если serviceName уже
        // был выставлен раньше этим же методом или update() выше. Идёт
        // через write() (не через this.client напрямую), как и остальные
        // записи в этом репозитории — CreateMotivationSchemaHandler вызывает
        // его уже внутри unitOfWork.run(), поэтому reentrancy-guard просто
        // переиспользует открытую транзакцию.
        await this.write(null, (client) =>
            client.motivationSchema.updateMany({
                where: { id, serviceName: null },
                data: { serviceName: name },
            }),
        );
    }
}
