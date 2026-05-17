import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { BitrixService } from '../../integrations/bitrix/bitrix.service';
import { RawBitrixDeal } from '../../integrations/bitrix/types';
import { BitrixDealUpsert } from './entities/bitrix.entity';
import { UploadLogger } from '../../utils/logger';

@Injectable()
export class BitrixSyncService {
  constructor(
    private readonly DB: DatabaseService,
    private readonly Bitrix: BitrixService,
  ) {}

  async uploadCreatedDeals(fromDate: undefined | Date = undefined) {
    return this._upload(
      fromDate,
      this.Bitrix.fetchCreatedDeals.bind(this.Bitrix),
    );
  }

  async uploadModifiedDeals(fromDate: Date) {
    return this._upload(
      fromDate,
      this.Bitrix.fetchModifiedDeals.bind(this.Bitrix),
    );
  }

  private async _upload(
    fromDate: Date | undefined = undefined,
    fetcher: (fromDate: Date | undefined) => AsyncGenerator<RawBitrixDeal[]>,
  ) {
    const label = fromDate
      ? `Сделки с ${fromDate.toLocaleDateString('ru')}`
      : 'Все сделки';
    const log = new UploadLogger(label);
    log.start();

    try {
      for await (const deals of fetcher(fromDate)) {
        await Promise.all(
          deals.map((deal: RawBitrixDeal) => {
            const data = this.mapFields(deal);
            return this.DB.bitrixDeal.upsert({
              where: { id: Number(deal.ID) },
              create: data,
              update: data,
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
      const employees = await this.Bitrix.fetchEmployees();
      await Promise.all(
        employees.map((e: any) =>
          this.DB.bitrixEmployee.upsert({
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
      const [{ LIST: deviceTypes }] = await this.Bitrix.fetchDeviceTypes();
      deviceTypes.push({ ID: 0, VALUE: 'Не заполнено' });
      await Promise.all(
        deviceTypes.map((source: any) =>
          this.DB.bitrixDeviceTypes.upsert({
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
      const [{ LIST: leadSources }] = await this.Bitrix.fetchLeadSources();
      leadSources.push({ ID: 0, VALUE: 'Не заполнено' });
      await Promise.all(
        leadSources.map((source: any) =>
          this.DB.bitrixLeadSources.upsert({
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
      const fields = await this.Bitrix.fetchEnums();
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
            this.DB.bitrixEnumValue.upsert({
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
      const stages = await this.Bitrix.fetchStages();
      await Promise.all(
        stages.map((s: any) =>
          this.DB.bitrixStage.upsert({
            where: { id: s.STATUS_ID },
            create: {
              id: s.STATUS_ID,
              name: s.NAME,
              sort: Number(s.SORT),
              color: s.COLOR ?? '',
              systemType: s.SYSTEM_TYPE ?? '',
              entityId: s.ENTITY_ID,
            },
            update: {
              name: s.NAME,
              sort: Number(s.SORT),
              color: s.COLOR ?? '',
              systemType: s.SYSTEM_TYPE ?? '',
            },
          }),
        ),
      );
      return stages.length;
    } catch (err) {
      throw new InternalServerErrorException(
        `Ошибка синхронизации стейджей: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async uploadSources() {
    try {
      const sources = await this.Bitrix.fetchSources();
      await Promise.all(
        sources.map((s: any) =>
          this.DB.bitrixPointOfContact.upsert({
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

  mapFields(d: RawBitrixDeal): BitrixDealUpsert {
    return {
      id: Number(d.ID),
      title: d.TITLE,
      categoryId: Number(d.CATEGORY_ID),
      stageId: d.STAGE_ID,
      opportunity: d.OPPORTUNITY ? parseFloat(d.OPPORTUNITY) : 0,
      assignedById: Number(d.ASSIGNED_BY_ID),
      contactId: d.CONTACT_ID ? Number(d.CONTACT_ID) : null,
      pointOfContactId: d.SOURCE_ID ? d.SOURCE_ID : null,
      leadSourceId: d.UF_CRM_1742462651851 ? Number(d.UF_CRM_1742462651851) : 0,
      brandId: d.UF_CRM_1730472738 ? Number(d.UF_CRM_1730472738) : null,
      deviceTypeId: d.UF_CRM_1703248170106 ? Number(d.UF_CRM_1703248170106) : 0,
      deviceModel: d.UF_CRM_1703248232698 ?? null,
      deviceMalfunction: d.UF_CRM_1703248682036 ?? null,
      createdAt: new Date(d.DATE_CREATE),
      updatedAt: d.DATE_MODIFY ? new Date(d.DATE_MODIFY) : null,
    };
  }
}
