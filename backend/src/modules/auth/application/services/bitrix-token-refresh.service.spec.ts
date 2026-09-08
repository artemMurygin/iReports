import axios from 'axios';
import { UnauthorizedException } from '@nestjs/common';
import { BitrixTokenRefreshService } from './bitrix-token-refresh.service';
import { BitrixEmployeeCredentials } from '../../domain/entities/bitrix-employee-credentials.entity';
import { BitrixCredentials } from '../../domain/value-objects/bitrix-credentials.value-object';
import type { BitrixEmployeeCredentialsRepositoryPort } from '../ports/bitrix-employee-credentials.port';
import { withRequestContext } from '@/shared/testing/with-request-context';

jest.mock('axios');
const axiosGet = jest.spyOn(axios, 'get');

// spec: auth#automatic-token-refresh — access_token обновляется через
// refresh_token ДО истечения срока действия, перед вызовом Bitrix24 REST от
// имени сотрудника (design.md, Decision 3 — oauth.bitrix24.tech, не legacy
// oauth.bitrix.info).
describe('BitrixTokenRefreshService', () => {
    const buildEntity = (expiresAt: Date) =>
        withRequestContext(() =>
            BitrixEmployeeCredentials.create({
                bitrixEmployeeId: 42,
                memberId: 'member-1',
                credentials: BitrixCredentials.create({
                    accessToken: 'old-access',
                    refreshToken: 'old-refresh',
                    expiresAt,
                }),
            }),
        );

    const createService = () => {
        const findByEmployeeId = jest.fn();
        const upsert = jest.fn().mockResolvedValue(undefined);
        const repository: BitrixEmployeeCredentialsRepositoryPort = {
            findByEmployeeId,
            upsert,
        };
        const service = new BitrixTokenRefreshService(repository);
        return { service, findByEmployeeId, upsert };
    };

    beforeEach(() => jest.clearAllMocks());

    it('возвращает текущий access_token, если он ещё не истёк', async () => {
        const { service, findByEmployeeId, upsert } = createService();
        findByEmployeeId.mockResolvedValue(
            buildEntity(new Date(Date.now() + 60_000)),
        );

        const token = await service.getValidAccessToken(42);

        expect(token).toBe('old-access');
        expect(axiosGet).not.toHaveBeenCalled();
        expect(upsert).not.toHaveBeenCalled();
    });

    it('обновляет access_token через refresh_token, если он истёк, и сохраняет результат', async () => {
        const { service, findByEmployeeId, upsert } = createService();
        findByEmployeeId.mockResolvedValue(
            buildEntity(new Date(Date.now() - 1000)),
        );
        axiosGet.mockResolvedValueOnce({
            data: {
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                expires_in: 3600,
            },
        });

        const token = await service.getValidAccessToken(42);

        expect(axiosGet).toHaveBeenCalledWith(
            'https://oauth.bitrix24.tech/oauth/token/',
            {
                params: expect.objectContaining({
                    grant_type: 'refresh_token',
                    refresh_token: 'old-refresh',
                }),
                timeout: 5_000,
            },
        );
        expect(token).toBe('new-access');
        expect(upsert).toHaveBeenCalledTimes(1);
    });

    it('бросает UnauthorizedException, если для сотрудника нет сохранённых токенов', async () => {
        const { service, findByEmployeeId } = createService();
        findByEmployeeId.mockResolvedValue(null);

        await expect(service.getValidAccessToken(999)).rejects.toThrow(
            UnauthorizedException,
        );
    });

    it('бросает UnauthorizedException, если Bitrix24 отклонил refresh_token', async () => {
        const { service, findByEmployeeId } = createService();
        findByEmployeeId.mockResolvedValue(
            buildEntity(new Date(Date.now() - 1000)),
        );
        axiosGet.mockRejectedValueOnce(new Error('invalid_grant'));

        await expect(service.getValidAccessToken(42)).rejects.toThrow(
            UnauthorizedException,
        );
    });
});
