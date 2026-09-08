import { NotFoundException } from '@/shared/exceptions';
import { shopSalaryRuleRegistry } from '../salary-rule-registry';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
} from '../types/salary-rule.types';

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

    // Зеркало SalaryRuleFactory.restore сервиса — восстановление правила,
    // УЖЕ существующего в БД под id, с обновлённым содержимым из PATCH
    // .../motivation-schema/:id (UpdateShopMotivationSchemaHandler): id
    // сохраняется, поэтому ShopSalaryRuleRepository.update() персистит
    // правку тем же id, не удаляя/пересоздавая строку — критично для
    // TaskCompletion (задача Bitrix24 остаётся привязанной к правилу).
    static restore(
        id: string,
        rule: CreateShopSalaryRuleProps,
    ): ShopSalaryRule {
        const ruleClass = shopSalaryRuleRegistry.get(rule.type);
        if (!ruleClass) {
            throw new NotFoundException(
                'Зарплатное правило магазина не найдено',
            );
        }
        return new ruleClass({
            id,
            props: {
                name: rule.name,
                type: rule.type,
                targetRole: rule.targetRole,
                config: rule.config,
            },
        });
    }
}
