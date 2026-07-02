import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { Direction } from '../../../prisma/generated/prisma/schema/client';

export type CategoryNode =
  | { id: number; name: string; parentId: number | null; depth: number }
  | { id: string; name: string; parentId: string | null; pathName: string };

@Injectable()
export class CategoriesService {
  constructor(private readonly db: DatabaseService) {}

  // Read-only: отдаёт дерево категорий напрямую из источника, без локальной витрины.
  getCategories(direction: Direction): Promise<CategoryNode[]> {
    return direction === Direction.SERVICE
      ? this.getRoappServiceCategories()
      : this.getMoySkladProductFolders();
  }

  private getRoappServiceCategories() {
    return this.db.roappServiceCategory.findMany({
      select: { id: true, name: true, parentId: true, depth: true },
      orderBy: [{ depth: 'asc' }, { name: 'asc' }],
    });
  }

  private getMoySkladProductFolders() {
    return this.db.moySkladProductFolder.findMany({
      where: { archived: false, parentId: null },
      select: { id: true, name: true, parentId: true, pathName: true },
      orderBy: { pathName: 'asc' },
    });
  }
}
