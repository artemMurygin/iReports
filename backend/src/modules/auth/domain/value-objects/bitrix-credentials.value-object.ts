import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export interface BitrixCredentialsProps {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

// Группа полей, всегда меняющихся вместе — обновление токена сотрудника
// (design.md, Decision 3) заменяет все три сразу, а не по отдельности.
// Инкапсулирует isExpired(), которым пользуется
// BitrixTokenRefreshService.getValidAccessToken (раздел 6 tasks.md) перед
// вызовом Bitrix24 REST от имени сотрудника.
export class BitrixCredentials extends ValueObject<BitrixCredentialsProps> {
    static create(props: BitrixCredentialsProps): BitrixCredentials {
        if (!props.accessToken || !props.accessToken.trim()) {
            throw new ArgumentInvalidException(
                'accessToken не может быть пустым',
            );
        }
        if (!props.refreshToken || !props.refreshToken.trim()) {
            throw new ArgumentInvalidException(
                'refreshToken не может быть пустым',
            );
        }
        if (!(props.expiresAt instanceof Date) || isNaN(props.expiresAt.getTime())) {
            throw new ArgumentInvalidException(
                'expiresAt должен быть корректной датой',
            );
        }

        return new BitrixCredentials({ ...props });
    }

    get accessToken(): string {
        return this.props.accessToken;
    }

    get refreshToken(): string {
        return this.props.refreshToken;
    }

    get expiresAt(): Date {
        return this.props.expiresAt;
    }

    isExpired(now: Date = new Date()): boolean {
        return this.props.expiresAt.getTime() <= now.getTime();
    }
}
