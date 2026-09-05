// Порт для чтения СУЩЕСТВУЮЩЕГО BitrixEmployee (bitrix.prisma) —
// принадлежит auth (единственный текущий потребитель), не заводит
// параллельный справочник: BitrixEmployee остаётся сквозной таблицей,
// используемой напрямую через Prisma в infrastructure/ (design.md,
// Decision 2 — isActive даёт проверку "уволенный не может войти" без
// дублирования логики в новой сущности).
//
// firstName/lastName добавлены разделом 12 tasks.md для GET /auth/me (spec:
// roles#get-current-user) — BitrixIdentityResolver по-прежнему читает
// только isActive, лишние поля ему не мешают. Опциональны (не ломают
// существующие типизированные моки раздела 5, где заполнены только
// id/isActive) — реальная реализация (BitrixEmployeeLookupRepository) всегда
// их отдаёт, GetCurrentUserHttpController использует '' как запасной
// вариант, если порт возвращает snapshot без имени (тестовые дублёры).
export interface BitrixEmployeeSnapshot {
    id: number;
    firstName?: string;
    lastName?: string;
    isActive: boolean;
}

export interface BitrixEmployeeLookupPort {
    findById(bitrixEmployeeId: number): Promise<BitrixEmployeeSnapshot | null>;
}

export const BITRIX_EMPLOYEE_LOOKUP_PORT = Symbol(
    'BITRIX_EMPLOYEE_LOOKUP_PORT',
);
