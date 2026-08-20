import { SalaryRulesCreate } from '../mediator/SalaryRulesCreate.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, узлы `tSYIw` (`Зарплатное правило · Создание
 * (Сервис)`) и `ZMEof` (`Зарплатное правило · Создание (Магазин)`) — страница создания зарплатной
 * схемы (Фаза 4 + Фаза 5 mobile adaptive, docs/salary-schema-creation-ui).
 *
 * Точка входа маршрута и ничего больше (frontend/CLAUDE.md, "страница — чистая склейка"):
 * оркестрация — в `mediator/SalaryRulesCreate.tsx`, состояние страницы — в
 * `model/useSalaryRulesPage.ts` (+ Шаг 1 в `model/useSchemaTarget.ts`), раскладка и слоты — в
 * `ui/Layout`, направление-специфичное — в `service/` и `shop/`, направление-агностичный Шаг 2 —
 * в `@/features/SalaryRuleForm` (переехал из `core/`, см. план "Редактирование зарплатных схем" —
 * та же механика теперь нужна и `pages/SalaryRuleDetail`).
 */
export function SalaryRulesPage() {
    return <SalaryRulesCreate />
}
