import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import type { PermissionCatalogRepositoryPort } from '../../application/ports/permission-catalog.port';
import type { PermissionCatalogEntry } from '../../application/ports/permission-registry.port';

// Каталог Permission — справочник, не аггрегат с доменным поведением
// (design.md, Decision 12): upsert по code напрямую через Prisma, без
// промежуточной domain-сущности — соответствует тому, что каталог не
// изменяется через доменные команды, только сидируется из кода.
@Injectable()
export class PermissionCatalogRepository
    implements PermissionCatalogRepositoryPort
{
    constructor(private readonly db: DatabaseService) {}

    async upsertMany(entries: PermissionCatalogEntry[]): Promise<void> {
        await Promise.all(
            entries.map((entry) =>
                this.db.permission.upsert({
                    where: { code: entry.code },
                    create: entry,
                    update: { label: entry.label, group: entry.group },
                }),
            ),
        );
    }

    async findAll(): Promise<PermissionCatalogEntry[]> {
        return this.db.permission.findMany({
            orderBy: [{ group: 'asc' }, { code: 'asc' }],
        });
    }

    async findManyByCodes(codes: string[]): Promise<PermissionCatalogEntry[]> {
        if (codes.length === 0) return [];
        return this.db.permission.findMany({ where: { code: { in: codes } } });
    }
}
