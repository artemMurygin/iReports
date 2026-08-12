import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as XLSX from 'xlsx';
import type { UpdateServicePricesResponse } from 'ireports-contracts';
import { ROAPP_GATEWAY } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.port';
import type { RoappGateway } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.port';
import type { Service } from '@/domains/service/integrations/roapp/schemas/services.schema';
import type { Category } from '@/domains/service/integrations/roapp/schemas/serviceCatalog.schema';
import { UpdateServicePricesCommand } from './update-service-prices.command';
import { ServicePriceChange } from '../../domain/value-objects/service-price-change.value-object';

// Порядок и состав колонок — как ждёт CustomApiRoapp /updateServices (см.
// перенесённый легаси SERVICE_PRICE_HEADERS,
// src/TODO/priceMonitoring/priceMonitoring.service.ts).
const SERVICE_PRICE_HEADERS = [
    'Штрих-код',
    'Тип',
    'Наименование',
    'Описание',
    'Единица измерения',
    'Категория',
    'Гарантия',
    'Период гарантии',
    'Продолжительность (минуты)',
    'Себестоимость',
    'Сумма вознаграждения',
    'Процент вознаграждения',
    'Расчет процента от',
    'Стандартная цена',
];

// Обновление цен услуг RoApp (Фаза 7,
// docs/todo-modules-ddd-refactoring/plan-todo-modules-ddd-refactoring.md) —
// перенос PriceMonitoringService.updateServicePricesInRoapp /
// buildServiceCategoryPaths за портом ROAPP_GATEWAY: выгрузка услуг и
// категорий, путей категорий, сборка XLSX и отправка — тот же алгоритм, что
// и в легаси, но без прямых инжектов RoappService/CustomApiRoappService (см.
// domains/service/CLAUDE.md, раздел про roapp-gateway).
@CommandHandler(UpdateServicePricesCommand)
export class UpdateServicePricesHandler implements ICommandHandler<
    UpdateServicePricesCommand,
    UpdateServicePricesResponse
> {
    private readonly logger = new Logger(UpdateServicePricesHandler.name);

    constructor(
        @Inject(ROAPP_GATEWAY) private readonly roappGateway: RoappGateway,
    ) {}

    async execute(
        command: UpdateServicePricesCommand,
    ): Promise<UpdateServicePricesResponse> {
        const changes = command.items.map((item) =>
            ServicePriceChange.create({
                serviceId: item.id,
                price: item.price,
                serviceCost: item.serviceCost,
            }),
        );

        const servicesById = new Map<number, Service>();
        for await (const batch of this.roappGateway.fetchServices()) {
            for (const service of batch) servicesById.set(service.id, service);
        }

        const categoryPathById = await this.buildServiceCategoryPaths();

        const rows = changes.flatMap((change) => {
            const service = servicesById.get(change.getServiceId());
            if (!service) {
                this.logger.warn(
                    `Roapp service ${change.getServiceId()} not found, skipping row`,
                );
                return [];
            }

            return [
                [
                    '', // Штрих-код
                    'Услуга', // Тип
                    service.name, // Наименование
                    '', // Описание
                    'pcs', // Единица измерения
                    categoryPathById.get(service.categoryId) ?? '', // Категория
                    service.warrantyPeriod, // Гарантия
                    service.warrantyUnit, // Период гарантии
                    '', // Продолжительность (минуты)
                    0, // Себестоимость
                    change.getServiceCost(), // Сумма вознаграждения
                    '', // Процент вознаграждения
                    '', // Расчет процента от
                    change.getPrice(), // Стандартная цена
                ],
            ];
        });

        const sheet = XLSX.utils.aoa_to_sheet([SERVICE_PRICE_HEADERS, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, 'Services');
        const buffer = XLSX.write(workbook, {
            type: 'buffer',
            bookType: 'xlsx',
        }) as Buffer;

        return this.roappGateway.updateServicesFromFile(buffer);
    }

    private async buildServiceCategoryPaths(): Promise<Map<number, string>> {
        const categories: Category[] = [];
        for await (const batch of this.roappGateway.fetchServiceCategories()) {
            categories.push(...batch);
        }
        const categoryMap = new Map(categories.map((c) => [c.id, c]));

        const pathCache = new Map<number, string>();
        const buildPath = (categoryId: number): string => {
            if (pathCache.has(categoryId)) return pathCache.get(categoryId)!;
            const category = categoryMap.get(categoryId);
            if (!category) return '';

            const parentPath = category.parent_id
                ? buildPath(category.parent_id)
                : '';
            const path = parentPath
                ? `${parentPath} > ${category.title}`
                : category.title;

            pathCache.set(categoryId, path);
            return path;
        };

        const result = new Map<number, string>();
        for (const id of categoryMap.keys()) result.set(id, buildPath(id));
        return result;
    }
}
