import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { CategoryNode } from '../../domain/value-objects/category-node.value-object';

interface FolderRow {
    id: string;
    name: string;
    pathName: string;
    parentId: string | null;
}

// spec: shop/warehouse#requirement-дерево-категорий-строится-из-уже-синхронизированного-справочника
//
// В отличие от ProductFolderTreeService (sync/moySklad/
// product-folder-tree.service.ts), которому нужны только id потомков ОДНОЙ
// выбранной ветки (и поэтому выгоден индексированный LIKE-запрос по
// pathName), здесь нужно дерево целиком — один findMany() и сборка в
// памяти дешевле, чем N запросов на уровень вложенности.
// spec: shop/warehouse#requirement-дерево-строится-одним-запросом-к-справочнику
// spec: shop/warehouse#requirement-архивные-категории-не-исключаются-из-дерева
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
