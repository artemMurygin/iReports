import { Inject, Injectable } from '@nestjs/common';
import {
    PERMISSION_REGISTRY,
    type PermissionCatalogEntry,
} from '../application/ports/permission-registry.port';
import {
    PERMISSION_CATALOG_REPOSITORY,
    type PermissionCatalogRepositoryPort,
} from '../application/ports/permission-catalog.port';

// Агрегирует реестры permission-кодов ВСЕХ модулей-владельцев
// (PERMISSION_REGISTRY, multi-провайдер) и делает идемпотентный upsert в
// таблицу Permission — единственный способ, которым каталог наполняется
// (design.md, Decision 12: не рантайм-сканирование, не свободный ввод через
// UI). Запускается отдельным скриптом при деплое (npm run seed:permissions),
// не при каждом старте приложения.
@Injectable()
export class PermissionsCatalogSeeder {
    constructor(
        @Inject(PERMISSION_REGISTRY)
        private readonly registries: PermissionCatalogEntry[][],
        @Inject(PERMISSION_CATALOG_REPOSITORY)
        private readonly repository: PermissionCatalogRepositoryPort,
    ) {}

    async seed(): Promise<void> {
        const entries = this.registries.flat();
        await this.repository.upsertMany(entries);
    }
}
