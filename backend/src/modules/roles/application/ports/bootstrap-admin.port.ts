// Владелец — src/modules/roles (design.md, Decision 9 — bootstrap первого
// администратора). Потребитель — оркестрация логина в src/modules/auth
// (AuthenticatedSessionIssuer, раздел 11 tasks.md): вызывается ПОСЛЕ
// резолва bitrixEmployeeId и ДО выдачи сессии, чтобы у только что
// назначенного администратора сразу были нужные permissions без релогина.
//
// hasAnyRole/assignAdministratorRole разнесены по двум методам (не один
// combined-метод), чтобы auth мог пропустить дорогой REST-вызов Bitrix24
// user.admin для сотрудников, у которых уже есть хотя бы одна роль —
// подавляющее большинство входов после самого первого администратора.
export interface BootstrapAdminPort {
    hasAnyRole(bitrixEmployeeId: number): Promise<boolean>;

    // Назначает системную роль Administrator (сидируется миграцией/
    // сид-скриптом раздела 3 со всем каталогом прав — см.
    // AdministratorRoleSeeder), если она уже существует. Если сид ещё не
    // прогнан (роль отсутствует) — молча ничего не делает, следующий вход
    // того же сотрудника попробует снова (design.md не описывает это как
    // блокирующую ошибку логина).
    assignAdministratorRole(bitrixEmployeeId: number): Promise<void>;
}

export const BOOTSTRAP_ADMIN_PORT = Symbol('BOOTSTRAP_ADMIN_PORT');
