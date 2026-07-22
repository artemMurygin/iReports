import { Direction } from '../../../../prisma/generated/prisma/schema/client';

// categoryExtId хранится полиморфно строкой (Goal/Reward/PlanTarget), без FK на источник.
// direction однозначно задаёт дерево-источник, поэтому каст выполняется вручную здесь —
// это единственное место, изолирующее разницу типов id между roapp_service_categories (int)
// и moy_sklad_product_folders (text). См. ARCHITECTURE.md §2.2 и §4.
export function castCategoryExtId(
  direction: Direction,
  categoryExtId: string,
): number | string {
  if (direction === Direction.SERVICE) {
    const id = Number.parseInt(categoryExtId, 10);
    if (Number.isNaN(id)) {
      throw new Error(
        `Некорректный categoryExtId для SERVICE (ожидался целый id roapp_service_categories): "${categoryExtId}"`,
      );
    }
    return id;
  }
  return categoryExtId;
}
