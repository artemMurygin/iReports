import { RawBitrixDeal } from './bitrix/bitrix.types';
import prisma from '../lib/prisma';
import { Bitrix } from './bitrix/bitrix.service';
import { UploadLogger } from '../utils/logger';



class DealsService {
    async getCreatedDeals(fromDate: undefined | Date = undefined) {
        return this._getDeals(fromDate,  Bitrix.fetchCreatedDeals);
    }

    async getModifiedDeals(fromDate: Date) {
        return this._getDeals(fromDate, Bitrix.fetchModifiedDeals);
    }

    private async _getDeals(fromDate: Date | undefined = undefined, fetcher: typeof Bitrix.fetchCreatedDeals) {

        const label = fromDate ? `Сделки с ${fromDate.toLocaleDateString('ru')}` : 'Все сделки';
        const log = new UploadLogger(label);
        log.start();

        try {
            for await (const deals of fetcher(fromDate)) {
                await prisma.bitrixDeal.createMany({
                    data: deals.map((d: RawBitrixDeal) => this.mapFields(d)),
                });
                log.tick(deals.length);
            }
            log.done();
        } catch (err) {
            log.error(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }

    async uploadInitBitrixData() {
        const log = new UploadLogger('Инициализация данных Bitrix');
        log.start();

        try {
            // Сотрудники
            const employees = await Bitrix.fetchEmployees();
            await Promise.all(employees.map((e: any) =>
                prisma.bitrixEmployee.upsert({
                    where: { id: Number(e.ID) },
                    create: { id: Number(e.ID), firstName: e.NAME ?? '', lastName: e.LAST_NAME ?? '' },
                    update: { firstName: e.NAME ?? '', lastName: e.LAST_NAME ?? '' },
                })
            ));
            log.tick(employees.length);

            // Енамы (пользовательские поля сделок)
            const fields = await Bitrix.fetchEnums();
            const enumValues = fields.flatMap((f: any) =>
                (f.LIST ?? []).map((item: any) => ({
                    id: Number(item.ID),
                    fieldName: f.FIELD_NAME as string,
                    value: item.VALUE as string,
                    sort: Number(item.SORT),
                }))
            );
            await Promise.all(enumValues.map((ev: { id: number; fieldName: string; value: string; sort: number }) =>
                prisma.bitrixEnumValue.upsert({
                    where: { id: ev.id },
                    create: ev,
                    update: { fieldName: ev.fieldName, value: ev.value, sort: ev.sort },
                })
            ));
            log.tick(enumValues.length);

            // Стейджи
            const stages = await Bitrix.fetchStages();
            await Promise.all(stages.map((s: any) =>
                prisma.bitrixStage.upsert({
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
                })
            ));
            log.tick(stages.length);

            // Источники
            const sources = await Bitrix.fetchSources();
            await Promise.all(sources.map((s: any) =>
                prisma.bitrixSource.upsert({
                    where: { id: s.STATUS_ID },
                    create: { id: s.STATUS_ID, name: s.NAME, sort: Number(s.SORT) },
                    update: { name: s.NAME, sort: Number(s.SORT) },
                })
            ));
            log.tick(sources.length);

            log.done();
        } catch (err) {
            log.error(err instanceof Error ? err : new Error(String(err)));
            throw err;
        }
    }

    mapFields(d: RawBitrixDeal) {
        return {
            id: Number(d.ID),
            title: d.TITLE,
            stageId: d.STAGE_ID,
            opportunity: d.OPPORTUNITY ? parseFloat(d.OPPORTUNITY) : null,
            assignedById: Number(d.ASSIGNED_BY_ID),
            contactId: d.CONTACT_ID ? Number(d.CONTACT_ID) : null,
            sourceId: d.SOURCE_ID ?? null,
            leadSourceId: d.UF_CRM_1742462651851 ? Number(d.UF_CRM_1742462651851) : null,
            brandId: d.UF_CRM_1730472738 ? Number(d.UF_CRM_1730472738) : null,
            deviceTypeId: d.UF_CRM_1703248170106 ? Number(d.UF_CRM_1703248170106) : null,
            deviceModel: d.UF_CRM_1703248232698 ?? null,
            deviceMalfunction: d.UF_CRM_1703248682036 ?? null,
            createdAt: new Date(d.DATE_CREATE),
            updatedAt: d.DATE_MODIFY ? new Date(d.DATE_MODIFY) : null,
        }
    }
}

const Deals = new DealsService();
export default Deals;
