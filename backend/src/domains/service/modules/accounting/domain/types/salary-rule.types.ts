import { CreateEntityProps } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import type { SalaryRuleRequest, TargetRole } from 'ireports-contracts';

export type { TargetRole };

export type PayPerHourSalaryConfig = {
    hours?: number;
    price: number;
    total?: number;
};

export type PayPerHourSalaryRule = {
    type: 'PayPerHour';
    name: string;
    targetRole: TargetRole;
    config: PayPerHourSalaryConfig;
};

export type ServiceCompletedSalaryConfig = {
    award:
        | { type: 'Fixed'; price: number }
        | { type: 'ServiceFixed' }
        | { type: 'ServicePercent'; percent: number };
};

export type ServiceCompletedSalaryRule = {
    type: 'ServiceCompleted';
    name: string;
    targetRole: TargetRole;
    config: ServiceCompletedSalaryConfig;
};

export type SalaryRuleConfig =
    | PayPerHourSalaryConfig
    | ServiceCompletedSalaryConfig;

// Форма запроса на создание правила — контракт (SalaryRuleRequest), а не
// подмножество из двух реализованных типов: контракт уже включает
// OrderPayed/TaskCompleted (сущности которых — заглушки до Фаз 7-8), и
// дублировать здесь список вручную значит расходиться с ним при каждом
// добавлении нового типа правила (см. docs/CLAUDE.md — контракты как
// единственный источник истины по форме данных). Незарегистрированный тип
// по-прежнему отклоняется в рантайме — SalaryRuleFactory.create() бросает
// NotFoundException, если типа нет в salaryRuleRegistry.
export type CreateSalaryRuleProps = SalaryRuleRequest;

export type SalaryRuleTypes = CreateSalaryRuleProps['type'];

export type SalaryRuleClass = {
    // CreateEntityProps<any>, а не <CreateSalaryRuleProps> — у каждого
    // конкретного класса (PayPerHoursEntity, ServiceCompletedEntity) свой
    // более узкий internal-props-тип (с литералом type: 'PayPerHour' и
    // т.п.), и при строгой проверке конструкторной сигнатуры это не даёт
    // положить класс в Map<SalaryRuleTypes, SalaryRuleClass> — конструктор
    // проверяется контравариантно, в отличие от обычных методов.
    new (props: CreateEntityProps<any>): SalaryRule;
    create(rule: CreateSalaryRuleProps): SalaryRule;
};

export type SalaryRule = {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly targetRole: TargetRole;
    readonly config: SalaryRuleConfig;
    // Отсутствовало до Фазы 6 — нужно ленивому кэшу расчёта (см.
    // domain/services/accounting-cache-freshness.ts), чтобы отличать версию
    // мотивационной схемы по факту правки правила, а не только самой схемы:
    // Entity (базовый класс всех конкретных правил) уже несёт updatedAt
    // рантайм-полем, здесь лишь делаем его частью структурного типа.
    readonly updatedAt: Date;
    calculate(
        context: CalculationContext,
    ): CalculationLine | Promise<CalculationLine>;
};
