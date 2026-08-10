import { NotFoundException } from '@/shared/exceptions';
import { salaryRuleRegistry } from '../salary-rule-registry';
import { CreateSalaryRuleProps, SalaryRule } from '../types/salary-rule.types';

export class SalaryRuleFactory {
    // Создание правила "с нуля" — id/даты генерирует сама сущность.
    // Восстановление уже существующего правила из БД — не задача фабрики,
    // см. SalaryRuleMapper.toDomain (прямой `new` в обход create()).
    static create(rule: CreateSalaryRuleProps): SalaryRule {
        const ruleClass = salaryRuleRegistry.get(rule.type);
        if (!ruleClass) {
            throw new NotFoundException('Зарплатное правило не найдено');
        }
        return ruleClass.create(rule);
    }
}
