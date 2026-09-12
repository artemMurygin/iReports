import { ServiceCategory } from '../value-objects/service-category.value-object';

// Раскрытие одной выбранной категории в id её самой и всех подкатегорий на
// любом уровне вложенности — перенос на backend логики, которая раньше
// дублировалась на фронтенде (frontend/src/shared/lib/tree.ts#getSubtreeIds),
// см. GetServicesAnalyticsService.
// spec: service/reports#requirement-отчёт-по-проданным-услугам-можно-ограничить-категорией-услуг-и-конкретными-услугами
export function resolveCategorySubtreeIds(
    categories: readonly ServiceCategory[],
    rootId: number,
): number[] {
    const ids = [rootId];
    const queue = [rootId];
    while (queue.length > 0) {
        const current = queue.shift()!;
        for (const category of categories) {
            if (category.getParentId() === current) {
                ids.push(category.getId());
                queue.push(category.getId());
            }
        }
    }
    return ids;
}
