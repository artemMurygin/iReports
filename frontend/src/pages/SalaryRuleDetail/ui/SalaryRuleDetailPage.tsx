import { useParams } from 'react-router-dom'

import { SalaryRuleEdit } from '../mediator/SalaryRuleEdit.tsx'

import { SchemaEditNotFound } from './SchemaEditNotFound.tsx'

/**
 * Точка входа маршрута `/salaries/rules/:direction/:id` (см. `app/router.tsx`) — заменяет прежний
 * "в разработке" placeholder. Ничего, кроме чтения route-параметров и передачи их в
 * `mediator/SalaryRuleEdit.tsx`, здесь нет (frontend/CLAUDE.md, "страница — чистая точка входа
 * маршрута"): направление фиксировано URL (см. `pages/SalaryRuleList/ui/SchemaGrid.tsx`'s ссылки),
 * вся оркестрация — в медиаторе.
 *
 * `direction`/`id` защищены минимальной проверкой корректности самого URL (не бизнес-логика, а
 * гигиена роутинга — тот же `SchemaEditNotFound`, что рендерит `service/ui/ServiceSchemaEdit.tsx`/
 * `shop/ui/ShopSchemaEdit.tsx` при 404 от API, используется и здесь для непарсящегося `:direction`).
 */
export function SalaryRuleDetailPage() {
    const { direction, id } = useParams<{ direction: string; id: string }>()

    if ((direction !== 'service' && direction !== 'shop') || !id) {
        return <SchemaEditNotFound />
    }

    return <SalaryRuleEdit direction={direction} id={id} />
}
