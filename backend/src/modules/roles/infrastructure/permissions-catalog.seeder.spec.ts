import { PermissionsCatalogSeeder } from './permissions-catalog.seeder';
import type { PermissionCatalogEntry } from '../application/ports/permission-registry.port';
import type { PermissionCatalogRepositoryPort } from '../application/ports/permission-catalog.port';

// spec: roles#permission-catalog-from-code — каталог наполняется ИСКЛЮЧИТЕЛЬНО
// из типизированных реестров модулей-владельцев при деплое (design.md,
// Decision 12), не рантайм-сканированием и не через UI.
describe('PermissionsCatalogSeeder', () => {
    class FakePermissionCatalogRepository implements PermissionCatalogRepositoryPort {
        readonly store = new Map<string, PermissionCatalogEntry>();
        upsertCalls = 0;

        upsertMany(entries: PermissionCatalogEntry[]): Promise<void> {
            this.upsertCalls++;
            for (const entry of entries) {
                this.store.set(entry.code, entry);
            }
            return Promise.resolve();
        }

        findAll(): Promise<PermissionCatalogEntry[]> {
            return Promise.resolve([...this.store.values()]);
        }

        findManyByCodes(codes: string[]): Promise<PermissionCatalogEntry[]> {
            return Promise.resolve(
                codes
                    .map((code) => this.store.get(code))
                    .filter(
                        (entry): entry is PermissionCatalogEntry => !!entry,
                    ),
            );
        }
    }

    it('агрегирует реестры нескольких модулей-владельцев в один upsert', async () => {
        const repo = new FakePermissionCatalogRepository();
        const rolesRegistry: PermissionCatalogEntry[] = [
            { code: 'roles:view', label: 'Просмотр ролей', group: 'Роли' },
            { code: 'roles:manage', label: 'Управление ролями', group: 'Роли' },
        ];
        const directoryRegistry: PermissionCatalogEntry[] = [
            {
                code: 'directory:manage',
                label: 'Управление справочником',
                group: 'Справочник',
            },
        ];
        const seeder = new PermissionsCatalogSeeder(
            [rolesRegistry, directoryRegistry],
            repo,
        );

        await seeder.seed();

        expect([...repo.store.keys()].sort()).toEqual([
            'directory:manage',
            'roles:manage',
            'roles:view',
        ]);
    });

    it('повторный запуск идемпотентен — не создаёт дублей', async () => {
        const repo = new FakePermissionCatalogRepository();
        const registry: PermissionCatalogEntry[] = [
            { code: 'roles:manage', label: 'Управление ролями', group: 'Роли' },
        ];
        const seeder = new PermissionsCatalogSeeder([registry], repo);

        await seeder.seed();
        await seeder.seed();

        expect(repo.store.size).toBe(1);
        expect(repo.upsertCalls).toBe(2);
    });

    it('не удаляет права, ранее заведённые другими модулями и отсутствующие в текущем прогоне', async () => {
        const repo = new FakePermissionCatalogRepository();
        repo.store.set('reports:view', {
            code: 'reports:view',
            label: 'Просмотр отчётов',
            group: 'Отчёты',
        });

        const seeder = new PermissionsCatalogSeeder(
            [
                [
                    {
                        code: 'roles:manage',
                        label: 'Управление ролями',
                        group: 'Роли',
                    },
                ],
            ],
            repo,
        );

        await seeder.seed();

        expect(repo.store.has('reports:view')).toBe(true);
        expect(repo.store.has('roles:manage')).toBe(true);
    });
});
