import { BitrixEmployeeCredentialsMapper } from './bitrix-employee-credentials.mapper';
import { BitrixEmployeeCredentials } from '../../domain/entities/bitrix-employee-credentials.entity';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('BitrixEmployeeCredentialsMapper', () => {
    const mapper = new BitrixEmployeeCredentialsMapper();

    it('toDomain восстанавливает сущность из записи БД', () => {
        const expiresAt = new Date('2026-08-10T12:00:00Z');
        const entity = mapper.toDomain({
            bitrixEmployeeId: 42,
            memberId: 'member-1',
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            accessExpiresAt: expiresAt,
            createdAt: expiresAt,
            updatedAt: expiresAt,
        });

        expect(entity).toBeInstanceOf(BitrixEmployeeCredentials);
        expect(entity.bitrixEmployeeId).toBe(42);
        expect(entity.memberId).toBe('member-1');
        expect(entity.credentials.accessToken).toBe('access-token');
        expect(entity.credentials.expiresAt).toEqual(expiresAt);
    });

    it('toPersistence сериализует сущность через connect на BitrixEmployee', () => {
        const entity = withRequestContext(() =>
            BitrixEmployeeCredentials.create({
                bitrixEmployeeId: 7,
                memberId: 'member-2',
                credentials: mapper.toDomain({
                    bitrixEmployeeId: 7,
                    memberId: 'member-2',
                    accessToken: 'a',
                    refreshToken: 'r',
                    accessExpiresAt: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }).credentials,
            }),
        );

        const record = mapper.toPersistence(entity);

        expect(record).toMatchObject({
            bitrixEmployee: { connect: { id: 7 } },
            memberId: 'member-2',
            accessToken: 'a',
            refreshToken: 'r',
        });
    });
});
