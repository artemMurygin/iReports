// Порт для чтения СУЩЕСТВУЮЩЕГО BitrixEmployee (bitrix.prisma) —
// принадлежит auth (единственный текущий потребитель), не заводит
// параллельный справочник: BitrixEmployee остаётся сквозной таблицей,
// используемой напрямую через Prisma в infrastructure/ (design.md,
// Decision 2 — isActive даёт проверку "уволенный не может войти" без
// дублирования логики в новой сущности).
export interface BitrixEmployeeSnapshot {
    id: number;
    isActive: boolean;
}

export interface BitrixEmployeeLookupPort {
    findById(bitrixEmployeeId: number): Promise<BitrixEmployeeSnapshot | null>;
}

export const BITRIX_EMPLOYEE_LOOKUP_PORT = Symbol(
    'BITRIX_EMPLOYEE_LOOKUP_PORT',
);
