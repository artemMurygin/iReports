import axios from 'axios';
import { BitrixPortalAdminCheckService } from './portal-admin-check.service';
import { DatabaseService } from '@/infrustructure/database/database.service';

jest.mock('axios');
// jest.spyOn(), а не прямой member access через (axios as jest.Mocked<...>).get
// — иначе @typescript-eslint/unbound-method ругается на передачу метода в expect().
const axiosGet = jest.spyOn(axios, 'get');

describe('BitrixPortalAdminCheckService', () => {
    const installation = {
        clientEndpoint: 'https://irepair.bitrix24.ru/rest/',
    };

    let findFirst: jest.Mock;
    let db: DatabaseService;
    let service: BitrixPortalAdminCheckService;

    beforeEach(() => {
        jest.clearAllMocks();
        findFirst = jest.fn().mockResolvedValue(installation);
        db = {
            bitrixInstallation: { findFirst },
        } as unknown as DatabaseService;
        service = new BitrixPortalAdminCheckService(db);
    });

    it('возвращает true, когда Bitrix REST user.admin отвечает true', async () => {
        axiosGet.mockResolvedValueOnce({ data: { result: true } });

        await expect(service.isPortalAdmin('token-1')).resolves.toBe(true);
        expect(axiosGet).toHaveBeenCalledWith(
            'https://irepair.bitrix24.ru/rest/user.admin',
            { params: { auth: 'token-1' }, timeout: 5_000 },
        );
    });

    it('возвращает false, когда Bitrix REST user.admin отвечает false', async () => {
        axiosGet.mockResolvedValueOnce({ data: { result: false } });

        await expect(service.isPortalAdmin('token-2')).resolves.toBe(false);
    });

    it('fail-closed: возвращает false, если установка Bitrix24 не найдена', async () => {
        findFirst.mockResolvedValueOnce(null);

        await expect(service.isPortalAdmin('token-3')).resolves.toBe(false);
        expect(axiosGet).not.toHaveBeenCalled();
    });

    it('fail-closed: возвращает false, если Bitrix24 недоступен (сеть/таймаут)', async () => {
        axiosGet.mockRejectedValueOnce(new Error('timeout'));

        await expect(service.isPortalAdmin('token-4')).resolves.toBe(false);
    });

    it('fail-closed: возвращает false на неожиданный формат ответа', async () => {
        axiosGet.mockResolvedValueOnce({ data: {} });

        await expect(service.isPortalAdmin('token-5')).resolves.toBe(false);
    });

    it('кэширует результат на короткое время — повторный вызов не бьёт в Bitrix24 снова', async () => {
        axiosGet.mockResolvedValueOnce({ data: { result: true } });

        await service.isPortalAdmin('token-6');
        await service.isPortalAdmin('token-6');

        expect(axiosGet).toHaveBeenCalledTimes(1);
        expect(findFirst).toHaveBeenCalledTimes(1);
    });

    it('кэш ключуется по токену — другой пользователь проверяется заново', async () => {
        axiosGet
            .mockResolvedValueOnce({ data: { result: true } })
            .mockResolvedValueOnce({ data: { result: false } });

        await expect(service.isPortalAdmin('admin-token')).resolves.toBe(true);
        await expect(service.isPortalAdmin('other-token')).resolves.toBe(false);
        expect(axiosGet).toHaveBeenCalledTimes(2);
    });
});
