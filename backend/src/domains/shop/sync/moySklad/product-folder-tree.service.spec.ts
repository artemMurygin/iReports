import { ProductFolderTreeService } from './product-folder-tree.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// issue #50 (Фаза 10): выборка по родительской категории должна захватывать
// товары из вложенных папок любого уровня вложенности, а не только прямых
// потомков.
//
// pathName у МойСклад — путь ПРЕДКОВ, не включая саму папку: у корневой
// "Техника" pathName = '', у её прямого потомка "Смартфоны" pathName =
// 'Техника' (полный путь родителя, не "Техника/Смартфоны"), у листа
// "iPhone" pathName = 'Техника/Смартфоны'.
describe('ProductFolderTreeService.resolveDescendantFolderIds', () => {
    // Дерево: Техника (root) -> Смартфоны -> iPhone (лист, третий уровень).
    const folders = {
        'folder-root': { id: 'folder-root', name: 'Техника', pathName: '' },
        'folder-mid': {
            id: 'folder-mid',
            name: 'Смартфоны',
            pathName: 'Техника',
        },
        'folder-leaf': {
            id: 'folder-leaf',
            name: 'iPhone',
            pathName: 'Техника/Смартфоны',
        },
        'folder-unrelated': {
            id: 'folder-unrelated',
            name: 'Аксессуары',
            pathName: '',
        },
    };

    const buildService = () => {
        const findUnique = jest.fn(
            ({ where: { id } }: { where: { id: string } }) =>
                Promise.resolve(folders[id as keyof typeof folders] ?? null),
        );
        const findMany = jest.fn(
            ({
                where: { OR },
            }: {
                where: {
                    OR: [
                        { pathName: string },
                        { pathName: { startsWith: string } },
                    ];
                };
            }) => {
                const [
                    { pathName: exact },
                    {
                        pathName: { startsWith },
                    },
                ] = OR;
                return Promise.resolve(
                    Object.values(folders)
                        .filter(
                            (f) =>
                                f.pathName === exact ||
                                f.pathName.startsWith(startsWith),
                        )
                        .map((f) => ({ id: f.id })),
                );
            },
        );
        const db = {
            moySkladProductFolder: { findUnique, findMany },
        } as unknown as DatabaseService;

        return { service: new ProductFolderTreeService(db), findMany };
    };

    it('захватывает потомков нескольких уровней вложенности и саму категорию', async () => {
        const { service } = buildService();

        const ids = await service.resolveDescendantFolderIds('folder-root');

        expect(ids.sort()).toEqual(
            ['folder-root', 'folder-mid', 'folder-leaf'].sort(),
        );
        expect(ids).not.toContain('folder-unrelated');
    });

    it('для промежуточной категории захватывает только её ветку, не поднимаясь к родителю', async () => {
        const { service } = buildService();

        const ids = await service.resolveDescendantFolderIds('folder-mid');

        expect(ids.sort()).toEqual(['folder-mid', 'folder-leaf'].sort());
        expect(ids).not.toContain('folder-root');
    });

    it('для листовой категории без потомков возвращает только её саму', async () => {
        const { service } = buildService();

        const ids = await service.resolveDescendantFolderIds('folder-leaf');

        expect(ids).toEqual(['folder-leaf']);
    });

    it('возвращает пустой массив для несуществующей категории', async () => {
        const { service } = buildService();

        const ids = await service.resolveDescendantFolderIds('unknown');

        expect(ids).toEqual([]);
    });

    it('запрашивает потомков одним запросом: прямые потомки — точное совпадение с полным путём категории, более глубокие — по префиксу', async () => {
        const { service, findMany } = buildService();

        await service.resolveDescendantFolderIds('folder-root');

        expect(findMany).toHaveBeenCalledTimes(1);
        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    OR: [
                        { pathName: 'Техника' },
                        { pathName: { startsWith: 'Техника/' } },
                    ],
                },
            }),
        );
    });
});
