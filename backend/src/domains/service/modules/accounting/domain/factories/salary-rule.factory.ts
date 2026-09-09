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

    // Восстановление правила, УЖЕ существующего в БД под id, с обновлённым
    // содержимым из PATCH .../motivation-schema/:id (UpdateMotivationSchemaHandler)
    // — id сохраняется (в отличие от create()), поэтому SalaryRuleRepository.update()
    // персистит правку тем же id, не удаляя/пересоздавая строку. Критично
    // для TaskCompletion: сохранённый id — это то, по чему SalaryTask и
    // связанная задача Bitrix24 остаются привязаны к правилу через PATCH
    // (см. design.md Decision 6, add-task-based-salary-rule). Props строятся
    // тем же приёмом, что и у SalaryRuleMapper.toDomain/*Entity.create() —
    // {name, type, targetRole, config}, одинаково для всех типов правил.
    static restore(id: string, rule: CreateSalaryRuleProps): SalaryRule {
        const ruleClass = salaryRuleRegistry.get(rule.type);
        if (!ruleClass) {
            throw new NotFoundException('Зарплатное правило не найдено');
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
