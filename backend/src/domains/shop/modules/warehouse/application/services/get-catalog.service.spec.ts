import { GetCatalogService } from './get-catalog.service';
import type { DatabaseService } from '@/infrustructure/database/database.service';

function buildService(rows: unknown[]) {
    const findMany = jest.fn(() => Promise.resolve(rows));
    const db = {
        moySkladProductFolder: { findMany },
    } as unknown as DatabaseService;

    return { service: new GetCatalogService(db), findMany };
}

describe('GetCatalogService.getTree', () => {
    it('для пустого справочника возвращает пустое дерево', async () => {
        const { service } = buildService([]);

        const tree = await service.getTree();

        expect(tree).toEqual([]);
    });

    it('собирает несколько уровней вложенности: родитель/потомки, а не плоский список', async () => {
        const { service } = buildService([
            {
                id: 'folder-root',
                name: 'Техника',
                pathName: 'Техника',
                parentId: null,
            },
            {
                id: 'folder-mid',
                name: 'Смартфоны',
                pathName: 'Техника/Смартфоны',
                parentId: 'folder-root',
            },
            {
                id: 'folder-leaf',
                name: 'iPhone',
                pathName: 'Техника/Смартфоны/iPhone',
                parentId: 'folder-mid',
            },
            {
                id: 'folder-other-root',
                name: 'Аксессуары',
                pathName: 'Аксессуары',
                parentId: null,
            },
        ]);

        const tree = await service.getTree();

        expect(tree).toHaveLength(2);
        const root = tree.find((node) => node.getId() === 'folder-root');
        expect(root).toBeDefined();
        expect(root!.getChildren()).toHaveLength(1);
        const mid = root!.getChildren()[0];
        expect(mid.getId()).toBe('folder-mid');
        expect(mid.getChildren()).toHaveLength(1);
        expect(mid.getChildren()[0].getId()).toBe('folder-leaf');
        expect(mid.getChildren()[0].getChildren()).toEqual([]);
    });

    it('включает архивные категории в дерево наравне с активными (не фильтрует)', async () => {
        const { service } = buildService([
            {
                id: 'folder-root',
                name: 'Техника',
                pathName: 'Техника',
                parentId: null,
            },
            {
                id: 'folder-archived',
                name: 'Старая категория',
                pathName: 'Техника/Старая категория',
                parentId: 'folder-root',
                archived: true,
            },
        ]);

        const tree = await service.getTree();

        const root = tree.find((node) => node.getId() === 'folder-root');
        expect(root!.getChildren().map((c) => c.getId())).toEqual([
            'folder-archived',
        ]);
    });

    it('читает справочник одним запросом', async () => {
        const { service, findMany } = buildService([]);

        await service.getTree();

        expect(findMany).toHaveBeenCalledTimes(1);
    });
});
