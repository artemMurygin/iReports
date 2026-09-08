import { NotFoundException } from '@nestjs/common';
import { BitrixEmployeeUpsertAdapter } from './bitrix-employee-upsert.adapter';
import type { BitrixUser } from '../../../integrations/bitrix/bitrix-api.types';

// spec: auth#self-heal-bitrix-employee — реализация
// BITRIX_EMPLOYEE_UPSERT_PORT.upsertOne (design.md, Decision 11): создаёт/
// обновляет BitrixEmployee по данным Bitrix REST, вызывается `auth` при
// логине сотрудника, для которого ещё нет строки BitrixEmployee.
describe('BitrixEmployeeUpsertAdapter', () => {
    const buildUser = (): BitrixUser => ({
        ID: '99',
        NAME: 'Пётр',
        LAST_NAME: 'Петров',
        UF_DEPARTMENT: [3],
        ACTIVE: true,
    });

    const createAdapter = () => {
        const bitrix = { fetchEmployeeById: jest.fn() } as any;
        const sync = {
            upsertEmployeeRecord: jest.fn().mockResolvedValue(undefined),
        } as any;
        const adapter = new BitrixEmployeeUpsertAdapter(bitrix, sync);
        return { adapter, bitrix, sync };
    };

    it('находит сотрудника по id и апсертит его через BitrixSyncService', async () => {
        const { adapter, bitrix, sync } = createAdapter();
        const user = buildUser();
        bitrix.fetchEmployeeById.mockResolvedValue(user);

        await adapter.upsertOne(99);

        expect(bitrix.fetchEmployeeById).toHaveBeenCalledWith(99);
        expect(sync.upsertEmployeeRecord).toHaveBeenCalledWith(user);
    });

    it('бросает NotFoundException, если Bitrix24 не знает такого пользователя', async () => {
        const { adapter, bitrix, sync } = createAdapter();
        bitrix.fetchEmployeeById.mockResolvedValue(null);

        await expect(adapter.upsertOne(404)).rejects.toThrow(NotFoundException);
        expect(sync.upsertEmployeeRecord).not.toHaveBeenCalled();
    });
});
