import { Inject, Injectable, Logger } from '@nestjs/common';
import {
    ROLE_REPOSITORY,
    type RoleRepositoryPort,
} from '../ports/role.repository.port';
import type { BootstrapAdminPort } from '../ports/bootstrap-admin.port';

// Название системной роли, засеиваемой AdministratorRoleSeeder при деплое
// (design.md, Decision 9, Migration Plan шаг 3) — единственная роль, на
// которую ссылается bootstrap первого администратора по имени.
export const ADMINISTRATOR_ROLE_NAME = 'Administrator';

// Реализация BOOTSTRAP_ADMIN_PORT (design.md, Decision 9) — вызывается
// оркестрацией логина в auth (AuthenticatedSessionIssuer) ДО выдачи сессии.
@Injectable()
export class BootstrapAdminRoleAssigner implements BootstrapAdminPort {
    private readonly logger = new Logger(BootstrapAdminRoleAssigner.name);

    constructor(
        @Inject(ROLE_REPOSITORY)
        private readonly roleRepository: RoleRepositoryPort,
    ) {}

    async hasAnyRole(bitrixEmployeeId: number): Promise<boolean> {
        return this.roleRepository.hasAnyRole(bitrixEmployeeId);
    }

    async assignAdministratorRole(bitrixEmployeeId: number): Promise<void> {
        const administratorRole = await this.roleRepository.findByName(
            ADMINISTRATOR_ROLE_NAME,
        );

        // Сид ещё не прогнан (деплой без npm run seed:permissions) — не
        // блокируем логин, следующий вход того же сотрудника попробует
        // снова, пока у него нет ни одной роли (design.md, Decision 9).
        if (!administratorRole) {
            this.logger.warn(
                `Bootstrap администратора: системная роль "${ADMINISTRATOR_ROLE_NAME}" ещё не засеяна — назначение пропущено для сотрудника ${bitrixEmployeeId}`,
            );
            return;
        }

        await this.roleRepository.assignToEmployee(
            bitrixEmployeeId,
            administratorRole.id,
        );
    }
}
