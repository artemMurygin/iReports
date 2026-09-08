import { z } from 'zod';

// Справочник складов МойСклад (shop-turnover-report, D2) — обычный
// постраничный справочник (GET /entity/store), как productFolders/employees.
// В отличие от них, локальная модель MoySkladStore хранит только (id, name)
// — остальные поля ответа МойСклад сейчас не нужны ни для одной бизнес-задачи
// (см. design.md D2), поэтому схема не транслирует их дальше.
export const StoreSchema = z
    .object({
        id: z.string(),
        name: z.string(),
    })
    .passthrough()
    .transform((d) => ({
        id: d.id,
        name: d.name,
    }));

export type Store = z.infer<typeof StoreSchema>;
