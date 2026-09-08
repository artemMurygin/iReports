import axios from 'axios';
import { UnauthorizedException } from '@nestjs/common';
import { BitrixIdentityResolver } from './bitrix-identity-resolver.service';
import type { BitrixEmployeeLookupPort } from '../ports/bitrix-employee-lookup.port';
import type { BitrixEmployeeUpsertPort } from '../../../../sync/bitrix/application/ports/bitrix-employee-upsert.port';

jest.mock('axios');
const axiosGet = jest.spyOn(axios, 'get');

// spec: auth#embedded-token-must-be-verified-via-rest — резолв
// bitrixEmployeeId ОБЯЗАТЕЛЬНО идёт через реальный REST-запрос к Bitrix24
// (user.current), общий шаг для embedded и OAuth сценариев (design.md,
// Decision 2). Также покрывает self-heal (Decision 11) и отказ уволенному
// сотруднику (isActive: false).
describe('BitrixIdentityResolver', () => {
    const clientEndpoint = 'https://irepair.bitrix24.ru/rest/';

    const createResolver = () => {
        const findById = jest.fn<
            ReturnType<BitrixEmployeeLookupPort['findById']>,
            Parameters<BitrixEmployeeLookupPort['findById']>
        >();
        const upsertOne = jest
            .fn<
                ReturnType<BitrixEmployeeUpsertPort['upsertOne']>,
                Parameters<BitrixEmployeeUpsertPort['upsertOne']>
            >()
            .mockResolvedValue(undefined);
        const lookup: BitrixEmployeeLookupPort = { findById };
        const upsert: BitrixEmployeeUpsertPort = { upsertOne };
        const resolver = new BitrixIdentityResolver(lookup, upsert);
        return { resolver, findById, upsertOne };
    };

    beforeEach(() => jest.clearAllMocks());

    it('резолвит bitrixEmployeeId через user.current для уже существующего активного сотрудника', async () => {
        const { resolver, findById, upsertOne } = createResolver();
        axiosGet.mockResolvedValueOnce({
            data: { result: { ID: '42', NAME: 'Иван', LAST_NAME: 'Иванов' } },
        });
        findById.mockResolvedValueOnce({ id: 42, isActive: true });

        const result = await resolver.resolveBitrixEmployeeId(
            'auth-token',
            clientEndpoint,
        );

        expect(axiosGet).toHaveBeenCalledWith(`${clientEndpoint}user.current`, {
            params: { auth: 'auth-token' },
            timeout: 5_000,
        });
        expect(result.bitrixEmployeeId).toBe(42);
        expect(result.profile.NAME).toBe('Иван');
        expect(upsertOne).not.toHaveBeenCalled();
    });

    it('самовосстанавливает отсутствующего BitrixEmployee через BITRIX_EMPLOYEE_UPSERT_PORT', async () => {
        const { resolver, findById, upsertOne } = createResolver();
        axiosGet.mockResolvedValueOnce({
            data: {
                result: { ID: '7', NAME: 'Новый', LAST_NAME: 'Сотрудник' },
            },
        });
        findById
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 7, isActive: true });

        const result = await resolver.resolveBitrixEmployeeId(
            'auth-token',
            clientEndpoint,
        );

        expect(upsertOne).toHaveBeenCalledWith(7);
        expect(result.bitrixEmployeeId).toBe(7);
    });

    it('отклоняет невалидный/просроченный токен (REST-запрос падает)', async () => {
        const { resolver } = createResolver();
        axiosGet.mockRejectedValueOnce(new Error('unauthorized'));

        await expect(
            resolver.resolveBitrixEmployeeId('fake-token', clientEndpoint),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('отклоняет неожиданный формат ответа Bitrix24 (fail-closed)', async () => {
        const { resolver } = createResolver();
        axiosGet.mockResolvedValueOnce({ data: {} });

        await expect(
            resolver.resolveBitrixEmployeeId('fake-token', clientEndpoint),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('отклоняет уволенного сотрудника (isActive: false)', async () => {
        const { resolver, findById } = createResolver();
        axiosGet.mockResolvedValueOnce({
            data: { result: { ID: '13', NAME: 'Уволенный', LAST_NAME: '' } },
        });
        findById.mockResolvedValueOnce({ id: 13, isActive: false });

        await expect(
            resolver.resolveBitrixEmployeeId('auth-token', clientEndpoint),
        ).rejects.toThrow(UnauthorizedException);
    });
});
