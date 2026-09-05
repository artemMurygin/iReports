import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import {
    BITRIX_EMPLOYEE_LOOKUP_PORT,
    type BitrixEmployeeLookupPort,
} from '../ports/bitrix-employee-lookup.port';
import {
    BITRIX_EMPLOYEE_UPSERT_PORT,
    type BitrixEmployeeUpsertPort,
} from '../../../../sync/bitrix/application/ports/bitrix-employee-upsert.port';
import type { BitrixCurrentUserProfile } from '../../domain/types/bitrix-current-user.type';

export interface ResolvedBitrixIdentity {
    bitrixEmployeeId: number;
    profile: BitrixCurrentUserProfile;
}

// Общий шаг резолва bitrixEmployeeId ОБЯЗАТЕЛЬНЫМ REST-запросом
// `user.current` — переиспользуется обоими сценариями входа (embedded,
// OAuth), т.к. proposal.md требует "единую точку сборки" (design.md,
// Decision 2). Приём — тот же, что и в
// BitrixPortalAdminCheckService.checkViaBitrix (fail-closed, таймаут 5с),
// но переиспользуется ТОЛЬКО техника, не код: разные REST-методы и разная
// область ответственности.
@Injectable()
export class BitrixIdentityResolver {
    constructor(
        @Inject(BITRIX_EMPLOYEE_LOOKUP_PORT)
        private readonly employeeLookup: BitrixEmployeeLookupPort,
        @Inject(BITRIX_EMPLOYEE_UPSERT_PORT)
        private readonly employeeUpsert: BitrixEmployeeUpsertPort,
    ) {}

    async resolveBitrixEmployeeId(
        accessToken: string,
        clientEndpoint: string,
    ): Promise<ResolvedBitrixIdentity> {
        const profile = await this.fetchCurrentUser(accessToken, clientEndpoint);
        const bitrixEmployeeId = Number(profile.ID);

        let employee = await this.employeeLookup.findById(bitrixEmployeeId);
        if (!employee) {
            // Самовосстановление (design.md, Decision 11) —
            // BitrixSyncService.uploadEmployees() не на кроне, новый
            // сотрудник иначе не смог бы войти до ручного npm run initial.
            await this.employeeUpsert.upsertOne(bitrixEmployeeId);
            employee = await this.employeeLookup.findById(bitrixEmployeeId);
        }

        if (!employee || !employee.isActive) {
            throw new UnauthorizedException(
                'Сотрудник не найден или уволен в Bitrix24 — вход запрещён',
            );
        }

        return { bitrixEmployeeId, profile };
    }

    private async fetchCurrentUser(
        accessToken: string,
        clientEndpoint: string,
    ): Promise<BitrixCurrentUserProfile> {
        try {
            const { data } = await axios.get<{
                result?: BitrixCurrentUserProfile;
            }>(`${clientEndpoint}user.current`, {
                params: { auth: accessToken },
                timeout: 5_000,
            });

            if (!data?.result?.ID) {
                throw new Error('Bitrix24 не подтвердил пользователя');
            }

            return data.result;
        } catch {
            // Fail-closed (design.md, Decision 10 применяется и здесь по
            // аналогии): любая ошибка — сеть, таймаут, неожиданный ответ —
            // трактуется как невалидный токен, доступ не выдаётся.
            throw new UnauthorizedException(
                'Не удалось подтвердить пользователя в Bitrix24: невалидный или истёкший токен',
            );
        }
    }
}
