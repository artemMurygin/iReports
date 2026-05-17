import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { RoappService } from '../../integrations/roapp/roapp.service';
import { UploadLogger } from '../../utils/logger';

@Injectable()
export class RoappSyncService {
  constructor(
    private readonly DB: DatabaseService,
    private readonly Roapp: RoappService,
  ) {}

  async upload

  async uploadEmployees() {
    try {
      const employees = await this.Roapp.fetchEmployees();
      await Promise.all(
        employees.map((e) =>
          this.DB.roappEmployee.upsert({
            where: { id: e.id },
            create: {
              id: e.id,
              firstName: e.first_name,
              lastName: e.last_name,
            },
            update: { firstName: e.first_name, lastName: e.last_name },
          }),
        ),
      );
      return employees.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации сотрудников: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadOrderStatuses() {
    try {
      const statuses = await this.Roapp.fetchOrderStatuses();
      await Promise.all(
        statuses.map((s) =>
          this.DB.roappOrderStatus.upsert({
            where: { id: s.id },
            create: {
              id: s.id,
              name: s.name,
              color: s.color,
              grupName: s.group,
            },
            update: { name: s.name, color: s.color, grupName: s.group },
          }),
        ),
      );
      return statuses.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации статусов заказов: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadOrderTypes() {
    try {
      const types = await this.Roapp.fetchOrderTypes();
      await Promise.all(
        types.map((t) =>
          this.DB.roappOrderType.upsert({
            where: { id: t.id },
            create: { id: t.id, name: t.title },
            update: { name: t.title },
          }),
        ),
      );
      return types.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации типов заказов: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadMarketingSources() {
    try {
      const sources = await this.Roapp.fetchMarketingSources();
      await Promise.all(
        sources.map((s) =>
          this.DB.roappMarketingSource.upsert({
            where: { id: s.id },
            create: { id: s.id, name: s.name },
            update: { name: s.name },
          }),
        ),
      );
      return sources.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации маркетинговых источников: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private topoSort<T extends { id: number; parent_id: number | null }>(
    items: T[],
  ): T[] {
    const map = new Map(items.map((i) => [i.id, i]));
    const visited = new Set<number>();
    const result: T[] = [];

    const visit = (item: T) => {
      if (visited.has(item.id)) return;
      if (item.parent_id !== null && map.has(item.parent_id)) {
        visit(map.get(item.parent_id)!);
      }
      visited.add(item.id);
      result.push(item);
    };

    items.forEach(visit);
    return result;
  }

  async uploadServiceCategories() {
    const log = new UploadLogger('Категории услуг');
    log.start();
    try {
      const all: { id: number; title: string; parent_id: number | null }[] = [];
      for await (const batch of this.Roapp.fetchServicesCategories()) {
        all.push(...batch);
      }

      const sorted = this.topoSort(all);
      for (const c of sorted) {
        await this.DB.roappServiceCategory.upsert({
          where: { id: c.id },
          create: { id: c.id, name: c.title, parentId: c.parent_id },
          update: { name: c.title, parentId: c.parent_id },
        });
        log.tick(1);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadProductCategories() {
    const log = new UploadLogger('Категории продуктов');
    log.start();
    try {
      const all: { id: number; title: string; parent_id: number | null }[] = [];
      for await (const batch of this.Roapp.fetchProductsCategories()) {
        all.push(...batch);
      }

      const sorted = this.topoSort(all);
      for (const c of sorted) {
        await this.DB.roappProductCategory.upsert({
          where: { id: c.id },
          create: { id: c.id, name: c.title, parentId: c.parent_id },
          update: { name: c.title, parentId: c.parent_id },
        });
        log.tick(1);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadServices() {
    const log = new UploadLogger('Услуги');
    log.start();

    try {
      // Загружаем все категории один раз
      const allCategories = await this.DB.roappServiceCategory.findMany();
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

      // Поднимаемся по дереву и раскладываем по уровням
      const resolveAncestors = (categoryId: number | null) => {
        if (!categoryId)
          return {
            workTypeId: null,
            brandId: null,
            deviceId: null,
            serviceTypeId: null,
            seriesId: null,
          };

        const path: number[] = [];
        let current = categoryMap.get(categoryId);

        while (current) {
          path.unshift(current.id);
          current = current.parentId
            ? categoryMap.get(current.parentId)
            : undefined;
        }

        // path = [корень(0), workType(1), brand(2), device(3), serviceType(4), series(5), category(6)]
        return {
          workTypeId: path[1] ?? null,
          brandId: path[2] ?? null,
          deviceId: path[3] ?? null,
          serviceTypeId: path[4] ?? null,
          seriesId: path[5] ?? null,
        };
      };

      for await (const services of this.Roapp.fetchServices()) {
        await Promise.all(
          services.map((s) => {
            const ancestors = resolveAncestors(s.categoryId ?? null);

            return this.DB.roappService.upsert({
              where: { id: s.id },
              create: {
                id: s.id,
                name: s.name,
                engeneerBonus: s.id ?? 0,
                price: s.price ?? 0,
                warranty: s.warranty,
                duration: s.duration,
                inCatalog: true,
                categoryId: s.categoryId ?? null,
                workTypeId: ancestors.workTypeId,
                brandId: ancestors.brandId,
                deviceId: ancestors.deviceId,
                serviceTypeId: ancestors.serviceTypeId,
                seriesId: ancestors.seriesId,
              },
              update: {
                categoryId: s.categoryId ?? null,
                workTypeId: ancestors.workTypeId,
                brandId: ancestors.brandId,
                deviceId: ancestors.deviceId,
                serviceTypeId: ancestors.serviceTypeId,
                seriesId: ancestors.seriesId,
              },
            });
          }),
        );
        log.tick(services.length);
      }

      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadProducts() {
    const log = new UploadLogger('Продукты');
    log.start();
    try {
      for await (const products of this.Roapp.fetchProducts()) {
        await Promise.all(
          products.map((p) =>
            this.DB.roappProduct.upsert({
              where: { id: p.id },
              create: {
                id: p.id,
                name: p.name,
                engeneerBonus: p.engeneerBonus,
                price: p.price,
                categoryId: p.categoryId,
              },
              update: {
                name: p.name,
                engeneerBonus: p.engeneerBonus,
                price: p.price,
                categoryId: p.categoryId,
              },
            }),
          ),
        );
        log.tick(products.length);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }
}
