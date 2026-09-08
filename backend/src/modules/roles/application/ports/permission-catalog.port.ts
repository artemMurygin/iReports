import type { PermissionCatalogEntry } from './permission-registry.port';

// Порт персистентности каталога Permission — используется только
// PermissionsCatalogSeeder (design.md, Decision 12) и query-хендлером
// каталога (раздел 9 tasks.md), не CRUD-эндпоинтом (каталог не создаётся
// через UI/API).
export interface PermissionCatalogRepositoryPort {
    // Идемпотентный upsert по code: повторный вызов с тем же набором не
    // создаёт дублей; коды, отсутствующие в текущем вызове (например,
    // принадлежащие другому модулю-владельцу), не удаляются.
    upsertMany(entries: PermissionCatalogEntry[]): Promise<void>;
    findAll(): Promise<PermissionCatalogEntry[]>;
    findManyByCodes(codes: string[]): Promise<PermissionCatalogEntry[]>;
}

export const PERMISSION_CATALOG_REPOSITORY = Symbol(
    'PERMISSION_CATALOG_REPOSITORY',
);
