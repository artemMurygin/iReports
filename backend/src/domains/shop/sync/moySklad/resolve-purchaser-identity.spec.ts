import { withRequestContext } from '@/shared/testing/with-request-context';
import { ResolveEmployeeByExternalIdService } from '@/modules/employee-identity/application/services/resolve-employee-by-external-id.service';
import type { EmployeeIdentityRepositoryPort } from '@/modules/employee-identity/application/ports/employee-identity.port';
import { EmployeeIdentity } from '@/modules/employee-identity/domain/entities/employee-identity.entity';
import {
    extractPurchaserExternalId,
    PURCHASER_ATTRIBUTE_NAME,
} from './moysklad-sync.mappers';

// issue #49/#51 (Фаза 10): сквозной тест на границе синка и
// EmployeeIdentity — значение доп. поля закупщика, извлечённое
// extractPurchaserExternalId из позиции отгрузки МойСклада, должно
// резолвиться в правильного Bitrix-сотрудника через тот же общий механизм,
// что строковое поле «онлайн-менеджер» RemOnline (Фаза 2). Проверяем оба
// типа значения атрибута МойСклад, допустимых PRD.
describe('Резолв закупщика БУ техники МойСклад в Bitrix-сотрудника', () => {
    const buildResolver = (found: EmployeeIdentity | null) => {
        const findByExternalId = jest.fn().mockResolvedValue(found);
        const repo: EmployeeIdentityRepositoryPort = {
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            findById: jest.fn(),
            findByEmployee: jest.fn(),
            findAll: jest.fn(),
            findByExternalId,
            findUnmatchedEmployees: jest.fn(),
        };
        return { resolver: new ResolveEmployeeByExternalIdService(repo) };
    };

    it('атрибут типа employee: id сотрудника МойСклад из href резолвится в Bitrix-сотрудника', async () => {
        await withRequestContext(async () => {
            const externalId = extractPurchaserExternalId(
                [
                    {
                        name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                        type: 'employee',
                        value: {
                            meta: {
                                href: 'https://api.moysklad.ru/api/remap/1.2/entity/employee/purchaser-1',
                            },
                        },
                    },
                ],
                PURCHASER_ATTRIBUTE_NAME.ONLINE,
            );
            expect(externalId).toBe('purchaser-1');

            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 7,
                system: 'MOY_SKLAD',
                identifierType: 'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                externalId: externalId!,
            });
            const { resolver } = buildResolver(identity);

            const resolvedEmployeeId = await resolver.execute(
                'MOY_SKLAD',
                'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                externalId,
            );

            expect(resolvedEmployeeId).toBe(7);
        });
    });

    it('атрибут произвольного (строкового) типа: голое значение резолвится в Bitrix-сотрудника', async () => {
        await withRequestContext(async () => {
            const externalId = extractPurchaserExternalId(
                [
                    {
                        name: PURCHASER_ATTRIBUTE_NAME.OFFLINE,
                        type: 'string',
                        value: 'Сидоров С.С.',
                    },
                ],
                PURCHASER_ATTRIBUTE_NAME.OFFLINE,
            );
            expect(externalId).toBe('Сидоров С.С.');

            const identity = EmployeeIdentity.create({
                bitrixEmployeeId: 11,
                system: 'MOY_SKLAD',
                identifierType: 'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
                externalId: externalId!,
            });
            const { resolver } = buildResolver(identity);

            const resolvedEmployeeId = await resolver.execute(
                'MOY_SKLAD',
                'MOY_SKLAD_OFFLINE_PURCHASER_FIELD',
                externalId,
            );

            expect(resolvedEmployeeId).toBe(11);
        });
    });

    it('возвращает null, если для значения доп. поля связь ещё не заведена', async () => {
        await withRequestContext(async () => {
            const externalId = extractPurchaserExternalId(
                [
                    {
                        name: PURCHASER_ATTRIBUTE_NAME.ONLINE,
                        type: 'string',
                        value: 'Незнакомый Закупщик',
                    },
                ],
                PURCHASER_ATTRIBUTE_NAME.ONLINE,
            );
            const { resolver } = buildResolver(null);

            const resolvedEmployeeId = await resolver.execute(
                'MOY_SKLAD',
                'MOY_SKLAD_ONLINE_PURCHASER_FIELD',
                externalId,
            );

            expect(resolvedEmployeeId).toBeNull();
        });
    });
});
