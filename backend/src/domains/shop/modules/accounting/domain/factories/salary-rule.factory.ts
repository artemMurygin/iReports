import { NotFoundException } from '@/shared/exceptions';
import { shopSalaryRuleRegistry } from '../salary-rule-registry';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
} from '../types/shop-salary-rule.types';

// Зеркало SalaryRuleFactory сервиса (Фаза 12, issue #57) — независимая
// фабрика магазина поверх shopSalaryRuleRegistry.
export class ShopSalaryRuleFactory {
    static create(rule: CreateShopSalaryRuleProps): ShopSalaryRule {
        const ruleClass = shopSalaryRuleRegistry.get(rule.type);
        if (!ruleClass) {
            throw new NotFoundException(
                'Зарплатное правило магазина не найдено',
            );
        }
        return ruleClass.create(rule);
    }
}
