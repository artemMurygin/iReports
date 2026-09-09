import { AggregateID } from '@/shared/domain/entity.base';
import { AggregateRoot } from '@/shared/domain/aggregate-root.base';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { BitrixCredentials } from '../value-objects/bitrix-credentials.value-object';

export interface BitrixEmployeeCredentialsProps {
    bitrixEmployeeId: number;
    memberId: string;
    credentials: BitrixCredentials;
}

// 1:1 с BitrixEmployee (design.md, Decision 3) — токены Bitrix24 КОНКРЕТНОГО
// сотрудника, отдельно от BitrixInstallation (токен установки приложения на
// портал). id сущности = String(bitrixEmployeeId) — естественный
// уникальный ключ агрегата, отдельный UUID не нужен.
export class BitrixEmployeeCredentials extends AggregateRoot<BitrixEmployeeCredentialsProps> {
    declare protected readonly _id: AggregateID;

    static create(
        props: BitrixEmployeeCredentialsProps,
    ): BitrixEmployeeCredentials {
        return new BitrixEmployeeCredentials({
            id: String(props.bitrixEmployeeId),
            props,
        });
    }

    get bitrixEmployeeId(): number {
        return this.props.bitrixEmployeeId;
    }

    get memberId(): string {
        return this.props.memberId;
    }

    get credentials(): BitrixCredentials {
        return this.props.credentials;
    }

    // BitrixCredentials меняются только все три поля сразу (см. VO) —
    // обновление токена сотрудника заменяет VO целиком, не по полям.
    updateCredentials(credentials: BitrixCredentials): void {
        this.props.credentials = credentials;
    }

    validate(): void {
        if (!this.props.bitrixEmployeeId) {
            throw new ArgumentInvalidException(
                'Необходимо указать сотрудника Bitrix для токенов входа',
            );
        }
        if (!this.props.memberId || !this.props.memberId.trim()) {
            throw new ArgumentInvalidException('memberId не может быть пустым');
        }
    }
}
