import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../infrustructure/database/database.service';
import { BitrixService } from '../../integrations/bitrix/bitrix.service';
import { BitrixDealSchema } from '../../integrations/bitrix/schema';
import { UploadLogger } from '../../shared/logger';

type BitrixDealInput = ReturnType<typeof BitrixDealSchema.parse>;

@Injectable()
export class BitrixSyncService {
  constructor(
    private readonly db: DatabaseService,
    private readonly bitrix: BitrixService,
  ) {}

  async uploadCreatedDeals(fromDate: undefined | Date = undefined) {
    return this._uploadDeals(
      fromDate,
      this.bitrix.fetchCreatedDeals.bind(this.bitrix),
    );
  }

  async uploadModifiedDeals(fromDate: Date) {
    return this._uploadDeals(
      fromDate,
      this.bitrix.fetchModifiedDeals.bind(this.bitrix),
    );
  }

  private async _uploadDeals(
    fromDate: Date | undefined = undefined,
    fetcher: (fromDate: Date | undefined) => AsyncGenerator<BitrixDealInput[]>,
  ) {
    const label = fromDate
      ? `Сделки с ${fromDate.toLocaleDateString('ru')}`
      : 'Все сделки';
    const log = new UploadLogger(label);
    log.start();

    const sources = await this.db.bitrixPointOfContact.findMany({
      select: { id: true },
    });
    const validSourceIds = new Set(sources.map((s) => s.id));

    try {
      for await (const deals of fetcher(fromDate)) {
        await Promise.all(
          deals.map((deal) => {
            if (
              deal.pointOfContactId &&
              !validSourceIds.has(deal.pointOfContactId)
            ) {
              deal.pointOfContactId = null;
            }
            return this.db.bitrixDeal.upsert({
              where: { id: deal.id },
              create: deal,
              update: deal,
            });
          }),
        );
        log.tick(deals.length);
      }
      log.done();
    } catch (err) {
      log.error(err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  async uploadEmployees() {
    try {
      const employees = await this.bitrix.fetchEmployees();
      await Promise.all(
        employees.map((e: any) =>
          this.db.bitrixEmployee.upsert({
            where: { id: Number(e.ID) },
            create: {
              id: Number(e.ID),
              firstName: e.NAME ?? '',
              lastName: e.LAST_NAME ?? '',
              department: e.UF_DEPARTMENT[0],
            },
            update: { firstName: e.NAME ?? '', lastName: e.LAST_NAME ?? '' },
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

  async uploadDeviceTypes() {
    try {
      const [{ LIST: deviceTypes }] = await this.bitrix.fetchDeviceTypes();
      deviceTypes.push({ ID: 0, VALUE: 'Не заполнено' });
      await Promise.all(
        deviceTypes.map((source: any) =>
          this.db.bitrixDeviceTypes.upsert({
            where: { id: Number(source.ID) },
            create: { id: Number(source.ID), name: source.VALUE },
            update: { name: source.VALUE },
          }),
        ),
      );
      return deviceTypes.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации типов устройств: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadLeadSources() {
    try {
      const [{ LIST: leadSources }] = await this.bitrix.fetchLeadSources();
      leadSources.push({ ID: 0, VALUE: 'Не заполнено' });
      await Promise.all(
        leadSources.map((source: any) =>
          this.db.bitrixLeadSources.upsert({
            where: { id: Number(source.ID) },
            create: { id: Number(source.ID), name: source.VALUE },
            update: { name: source.VALUE },
          }),
        ),
      );
      return leadSources.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации источников лидов: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadEnums() {
    try {
      const fields = await this.bitrix.fetchEnums();
      const enumValues = fields.flatMap((f: any) =>
        (f.LIST ?? []).map((item: any) => ({
          id: Number(item.ID),
          fieldName: f.FIELD_NAME as string,
          value: item.VALUE as string,
          sort: Number(item.SORT),
        })),
      );
      await Promise.all(
        enumValues.map(
          (ev: {
            id: number;
            fieldName: string;
            value: string;
            sort: number;
          }) =>
            this.db.bitrixEnumValue.upsert({
              where: { id: ev.id },
              create: ev,
              update: {
                fieldName: ev.fieldName,
                value: ev.value,
                sort: ev.sort,
              },
            }),
        ),
      );
      return enumValues.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации enum-значений: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadStages() {
    try {
      const stages = await this.bitrix.fetchStages();
      await Promise.all(
        stages.map((s: any) => {
          const { stageGroupId, stageGroupName } = this.resolveStageGroup(
            s.ENTITY_ID,
            s.COLOR ?? '',
          );
          return this.db.bitrixStage.upsert({
            where: { id: s.STATUS_ID },
            create: {
              id: s.STATUS_ID,
              name: s.NAME,
              sort: Number(s.SORT),
              color: s.COLOR ?? '',
              systemType: s.SYSTEM_TYPE ?? '',
              entityId: s.ENTITY_ID,
              stageGroupId,
              stageGroupName,
            },
            update: {
              name: s.NAME,
              sort: Number(s.SORT),
              color: s.COLOR ?? '',
              systemType: s.SYSTEM_TYPE ?? '',
              stageGroupId,
              stageGroupName,
            },
          });
        }),
      );
      return stages.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации стейджей: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private resolveStageGroup(
    entityId: string,
    color: string,
  ): { stageGroupId: string | null; stageGroupName: string | null } {
    if (entityId !== 'DEAL_STAGE' && entityId !== 'STATUS')
      return { stageGroupId: null, stageGroupName: null };

    const map: Record<string, { id: string; name: string }> = {
      '#C6DF9C': { id: 'new', name: 'Новые' },
      '#ACD372': { id: 'inWork', name: 'В работе' },
      '#588528': { id: 'waitingForVisit', name: 'Записан на ремонт' },
      '#3E6617': { id: 'repairing', name: 'Ремонтируются' },
      '#005824': { id: 'won', name: 'Успешная сделка' },
      '#FE5957': { id: 'lose', name: 'Проигранная сделка' },
      '#FF0000': { id: 'nonTarget', name: 'нецелевой лид' },
    };

    const entry = map[color.toUpperCase()];
    return entry
      ? { stageGroupId: entry.id, stageGroupName: entry.name }
      : { stageGroupId: null, stageGroupName: null };
  }

  async uploadSources() {
    try {
      const sources = await this.bitrix.fetchSources();
      await Promise.all(
        sources.map((s: any) =>
          this.db.bitrixPointOfContact.upsert({
            where: { id: s.STATUS_ID },
            create: { id: s.STATUS_ID, name: s.NAME, sort: Number(s.SORT) },
            update: { name: s.NAME, sort: Number(s.SORT) },
          }),
        ),
      );
      return sources.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации источников: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
