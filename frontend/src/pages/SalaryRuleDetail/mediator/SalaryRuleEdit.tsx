import { ServiceSchemaEdit } from '../service/ui/ServiceSchemaEdit.tsx'
import { ShopSchemaEdit } from '../shop/ui/ShopSchemaEdit.tsx'

export type SalaryRuleEditProps = {
    direction: 'service' | 'shop'
    id: string
}

/**
 * Direction фиксирован маршрутом (`/salaries/rules/:direction/:id`, см. `app/router.tsx`) — в
 * отличие от `pages/SalaryRules`'s создания, здесь нет переключателя направления, поэтому вместо
 * "вызвать оба адаптера безусловно и выбрать активный" (паттерн `useSalaryRulesPage.ts`) страница
 * просто рендерит один из двух независимых поддеревьев `service/`/`shop`. Rules-of-hooks это не
 * нарушает: `direction` — стабильный на время жизни этого узла пропс (react-router меняет его,
 * только полностью переисполняя дерево под `/salaries/rules/:direction/:id`), а не значение,
 * решаемое внутри одного и того же смонтированного компонента.
 */
export function SalaryRuleEdit({ direction, id }: SalaryRuleEditProps) {
    return direction === 'service' ? <ServiceSchemaEdit id={id} /> : <ShopSchemaEdit id={id} />
}
