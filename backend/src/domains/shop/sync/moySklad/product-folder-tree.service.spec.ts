import { ProductFolderTreeService } from './product-folder-tree.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';

// issue #50 (Фаза 10): выборка по родительской категории должна захватывать
// товары из вложенных папок любого уровня вложенности, а не только прямых
// потомков.
describe('ProductFolderTreeService.resolveDescendantFolderIds', () => {
    // Дерево: Техника (root) -> Смартфоны -> iPhone (лист, третий уровень).
    const folders = {
        'folder-root': { id: 'folder-root', pathName: 'Техника' },
        'folder-mid': { id: 'folder-mid', pathName: 'Техника/Смартфоны' },
        'folder-leaf': {
            id: 'folder-leaf',
            pathName: 'Техника/Смартфоны/iPhone',
        },
        'folder-unrelated': { id: 'folder-unrelated', pathName: 'Аксессуары' },
    };

    const buildService = () => {
        const findUnique = jest.fn(
            ({ where: { id } }: { where: { id: string } }) =>
                Promise.resolve(folders[id as keyof typeof folders] ?? null),
        );
        const findMany = jest.fn(
            ({
                where: {
                    pathName: { startsWith },
                },
            }: {
                where: { pathName: { startsWith: string } };
            }) =>
                Promise.resolve(
                    Object.values(folders)
                        .filter((f) => f.pathName.startsWith(startsWith))
                        .map((f) => ({ id: f.id })),
                ),
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

    it('запрашивает потомков одним запросом по префиксу pathName родителя', async () => {
        const { service, findMany } = buildService();

        await service.resolveDescendantFolderIds('folder-root');

        expect(findMany).toHaveBeenCalledTimes(1);
        expect(findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { pathName: { startsWith: 'Техника/' } },
            }),
        );
    });
});
