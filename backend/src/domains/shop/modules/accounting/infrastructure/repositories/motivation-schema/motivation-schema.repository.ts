import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { Prisma } from '../../../../../../../../prisma/generated/prisma/schema/client';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { PrismaRepository } from '@/shared/infrastructure/persistence/prisma.repository';
import { ShopMotivationSchemaMapper } from '../../mappers/motivation-schema/motivation-schema.mapper';

// Зеркало domains/service/modules/accounting/infrastructure/repositories/
// motivation-schema.repository.ts (Фаза 13.5, issue #57) — независимая
// копия для направления shop.
@Injectable()
export class ShopMotivationSchemaRepository
    extends PrismaRepository
    implements ShopMotivationSchemaRepositoryPort
{
    private readonly mapper = new ShopMotivationSchemaMapper();

    constructor(db: DatabaseService) {
        super(db);
    }

    async insert(entity: ShopMotivationSchema): Promise<void> {
        // write() сам оборачивает запись в транзакцию (даже одиночную) и
        // после коммита опубликует ShopMotivationSchemaCreatedDomainEvent,
        // накопленный на entity в ShopMotivationSchema.create().
        await this.write(entity, (client) =>
            client.motivationSchema.create({
                data: this.mapper.toPersistence(entity),
            }),
        );
    }

    async findByEmployee(
        employeeId: number,
    ): Promise<ShopMotivationSchema | null> {
        // Чтение, а не запись — идёт через this.client (подхватывает
        // открытую транзакцию, если есть), а не через write().
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType: 'Employee', targetId: employeeId },
            // direction: 'shop' — MotivationSchema сотрудника может
            // содержать правила ОБОИХ направлений (сотрудник числится и в
            // RemOnline, и в МойСклад, см. Фаза 2/EmployeeIdentity), а
            // `type` правил у двух направлений пересекается буквально
            // ('PayPerHour' есть и там, и там) — без этого фильтра
            // ShopSalaryRuleMapper.toDomain мог бы получить чужую
            // (service) строку и попытаться резолвнуть её несуществующим
            // для этого реестра типом. См. комментарий у
            // SalaryRule.direction в salary.prisma (Фаза 12).
            include: { rules: { where: { direction: 'shop' } } },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findByDepartment(
        departmentId: number,
    ): Promise<ShopMotivationSchema | null> {
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType: 'Department', targetId: departmentId },
            // direction: 'shop' — см. комментарий в findByEmployee выше.
            include: { rules: { where: { direction: 'shop' } } },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findAllEmployeeTargets(): Promise<ShopMotivationSchema[]> {
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Employee' },
            // direction: 'shop' — см. комментарий в findByEmployee выше.
            include: { rules: { where: { direction: 'shop' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async findAllDepartmentTargets(): Promise<ShopMotivationSchema[]> {
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Department' },
            // direction: 'shop' — см. комментарий в findByEmployee выше.
            include: { rules: { where: { direction: 'shop' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    async findByEmployees(
        employeeIds: number[],
    ): Promise<ShopMotivationSchema[]> {
        if (employeeIds.length === 0) {
            return [];
        }
        const records = await this.client.motivationSchema.findMany({
            where: { targetType: 'Employee', targetId: { in: employeeIds } },
            // direction: 'shop' — см. комментарий в findByEmployee выше.
            include: { rules: { where: { direction: 'shop' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    // MotivationSchema в БД не хранит direction (естественный ключ —
    // только targetType/targetId), поэтому find-or-create для
    // CreateShopMotivationSchemaHandler (реализуется в следующей фазе)
    // ищет существующую строку по этому ключу напрямую, минуя include
    // rules — id достаточно, чтобы решить insert vs переиспользование уже
    // созданной сервисным направлением строки для того же сотрудника.
    async findIdByTarget(
        targetType: 'Department' | 'Employee',
        targetId: number,
    ): Promise<string | null> {
        const record = await this.client.motivationSchema.findFirst({
            where: { targetType, targetId },
            select: { id: true },
        });

        return record?.id ?? null;
    }

    // Страница просмотра/редактирования зарплатных схем (список + деталь).
    // direction: 'shop' в include.rules — тот же приём, что и в
    // findByEmployee выше; строка с 0 правилами shop не отфильтровывается
    // здесь (это решение application-слоя, см. GetShopMotivationSchemaService/
    // ListShopMotivationSchemasService), только маппится как есть.
    async findById(id: string): Promise<ShopMotivationSchema | null> {
        const record = await this.client.motivationSchema.findUnique({
            where: { id },
            include: { rules: { where: { direction: 'shop' } } },
        });

        return record ? this.mapper.toDomain(record) : null;
    }

    async findAll(filters: {
        targetType?: 'Department' | 'Employee';
        targetId?: number;
        search?: string;
    }): Promise<ShopMotivationSchema[]> {
        const where: Prisma.MotivationSchemaWhereInput = {};
        if (filters.targetType) {
            where.targetType = filters.targetType;
        }
        if (filters.targetId !== undefined) {
            where.targetId = filters.targetId;
        }
        if (filters.search) {
            // Поиск идёт по shopName (реальное отображаемое имя для этого
            // направления), а не по общей legacy-колонке `name` — после
            // PATCH другого направления она перестаёт совпадать с именем,
            // которое видит пользователь (см. комментарий у shopName в
            // salary.prisma). Вторая ветка OR — фолбэк на `name` для строк,
            // у которых shopName ещё NULL (до миграции/до первого
            // create-запроса со стороны shop), тот же приём, что и в
            // ShopMotivationSchemaMapper.toDomain.
            where.OR = [
                {
                    shopName: {
                        contains: filters.search,
                        mode: 'insensitive',
                    },
                },
                {
                    shopName: null,
                    name: { contains: filters.search, mode: 'insensitive' },
                },
            ];
        }

        const records = await this.client.motivationSchema.findMany({
            where,
            include: { rules: { where: { direction: 'shop' } } },
        });

        return records.map((record) => this.mapper.toDomain(record));
    }

    // Персист ShopMotivationSchema.rename() — только name; target/rules
    // этим методом не меняются (rules пишутся/удаляются отдельно через
    // ShopSalaryRuleRepository, см. UpdateShopMotivationSchemaHandler).
    // Пишет ТОЛЬКО shopName — общая с service-направлением колонка `name`
    // больше не трогается этим методом (кросс-направленческий баг
    // переименования, см. комментарий у shopName в salary.prisma).
    async update(entity: ShopMotivationSchema): Promise<void> {
        const props = entity.getProps();
        await this.write(entity, (client) =>
            client.motivationSchema.update({
                where: { id: entity.id },
                data: { shopName: props.name },
            }),
        );
    }

    async initializeName(id: string, name: string): Promise<void> {
        // updateMany с условием shopName: null в where — атомарная
        // "установить, только если ещё не установлено": повторный
        // create-запрос со стороны shop на уже существующую (созданную
        // service-стороной) строку не переименовывает её, если shopName уже
        // был выставлен раньше этим же методом или update() выше. Идёт
        // через write() (не через this.client напрямую), как и остальные
        // записи в этом репозитории — CreateShopMotivationSchemaHandler
        // вызывает его уже внутри unitOfWork.run(), поэтому
        // reentrancy-guard просто переиспользует открытую транзакцию.
        await this.write(null, (client) =>
            client.motivationSchema.updateMany({
                where: { id, shopName: null },
                data: { shopName: name },
            }),
        );
    }
}
