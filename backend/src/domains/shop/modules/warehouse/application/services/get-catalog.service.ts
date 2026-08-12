import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { CategoryNode } from '../../domain/value-objects/category-node.value-object';

interface FolderRow {
    id: string;
    name: string;
    pathName: string;
    parentId: string | null;
}

// Строит дерево категорий каталога магазина из уже синхронизированной
// таблицы MoySkladProductFolder (Фаза 10 domains/shop/sync/moySklad) —
// единственный источник данных, без нового синка (см. PRD, "В скоупе").
// В отличие от ProductFolderTreeService (sync/moySklad/
// product-folder-tree.service.ts), которому нужны только id потомков ОДНОЙ
// выбранной ветки (и поэтому выгоден индексированный LIKE-запрос по
// pathName), здесь нужно дерево целиком — один findMany() и сборка в
// памяти дешевле, чем N запросов на уровень вложенности. Архивные
// категории (archived: true) не отфильтровываются — то же поведение, что
// и у ProductFolderTreeService, справочник не должен молча терять узлы,
// на которые могут ссылаться архивные товары.
@Injectable()
export class GetCatalogService {
    constructor(private readonly db: DatabaseService) {}

    async getTree(): Promise<CategoryNode[]> {
        const folders = await this.db.moySkladProductFolder.findMany({
            select: { id: true, name: true, pathName: true, parentId: true },
            orderBy: { name: 'asc' },
        });

        return this.buildTree(folders);
    }

    private buildTree(folders: FolderRow[]): CategoryNode[] {
        const childrenByParentId = new Map<string | null, FolderRow[]>();
        for (const folder of folders) {
            const siblings = childrenByParentId.get(folder.parentId) ?? [];
            siblings.push(folder);
            childrenByParentId.set(folder.parentId, siblings);
        }

        const toNode = (folder: FolderRow): CategoryNode =>
            CategoryNode.create({
                id: folder.id,
                name: folder.name,
                pathName: folder.pathName,
                children: (childrenByParentId.get(folder.id) ?? []).map(toNode),
            });

        return (childrenByParentId.get(null) ?? []).map(toNode);
    }
}
