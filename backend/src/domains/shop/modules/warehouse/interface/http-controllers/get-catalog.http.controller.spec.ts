import { GetCatalogHttpController } from './get-catalog.http.controller';
import { GetCatalogService } from '../../application/services/get-catalog.service';
import { CategoryNode } from '../../domain/value-objects/category-node.value-object';

describe('GetCatalogHttpController', () => {
    it('отдаёт дерево категорий в форме ответа контракта (родитель/потомки)', async () => {
        const tree = [
            CategoryNode.create({
                id: 'folder-root',
                name: 'Техника',
                pathName: 'Техника',
                children: [
                    CategoryNode.create({
                        id: 'folder-leaf',
                        name: 'iPhone',
                        pathName: 'Техника/iPhone',
                        children: [],
                    }),
                ],
            }),
        ];
        const getTree = jest.fn().mockResolvedValue(tree);
        const getCatalogService = {
            getTree,
        } as unknown as GetCatalogService;
        const controller = new GetCatalogHttpController(getCatalogService);

        const result = await controller.get();

        expect(getTree).toHaveBeenCalledTimes(1);
        expect(result).toEqual([
            {
                id: 'folder-root',
                name: 'Техника',
                pathName: 'Техника',
                children: [
                    {
                        id: 'folder-leaf',
                        name: 'iPhone',
                        pathName: 'Техника/iPhone',
                        children: [],
                    },
                ],
            },
        ]);
    });
});
