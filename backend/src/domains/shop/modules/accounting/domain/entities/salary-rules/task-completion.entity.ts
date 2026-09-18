import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { Period } from '@/shared/domain/period.value-object';
import {
    CreateShopSalaryRuleProps,
    ShopSalaryRule,
    TargetRole,
    TaskCompletionShopSalaryConfig,
    TaskCompletionShopSalaryRule,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/calculation-context.types';
import type { ShopCalculationErpData } from '@/domains/shop/modules/accounting/domain/types/calculation-data.types';
import { DeadlinePeriodOffset } from '@/domains/shop/modules/accounting/domain/value-objects/deadline-period-offset.value-object';

// openspec/changes/replace-bitrix-task-integration — зеркало TaskCompletion
// сервиса (domains/service/modules/accounting/domain/entities/salary-rules/
// task-completion.entity.ts), независимая копия для направления shop
// (issue #57 — не переиспользует ни один класс сервиса).
//
// spec: shop/accounting#requirement-строка-правила-за-выполнение-задачи-появляется-сразу-и-растёт-по-статусу-задачи
// (task-completion-progressive-visibility — пересматривает прежнее решение
// «не видно в прогнозе до выполнения»)
//
// В отличие от остальных типов правил магазина (ProductSold/
// UsedProductSold/PayPerHour), TaskCompletionShop не матчит сотрудника по
// полям ERP-данных — правило целиком привязано к ОДНОМУ конкретному
// сотруднику через его мотивационную схему, поэтому calculate() не
// фильтрует erpData по роли, а лишь смотрит статус СВОЕЙ связанной задачи
// по ключу this.id в erpData.taskCompletionStatuses (заполняется
// task-completion-statuses.builder.ts, design.md решение 5).
export class TaskCompletionShop
    extends Entity<TaskCompletionShopSalaryRule>
    implements ShopSalaryRule
{
    declare protected _id: AggregateID;

    get name(): string {
        return this.props.name;
    }

    get type(): string {
        return this.props.type;
    }

    get targetRole(): TargetRole {
        return this.props.targetRole;
    }

    get config(): TaskCompletionShopSalaryConfig {
        return this.props.config;
    }

    get isActive(): boolean {
        return this.props.isActive;
    }

    // Soft-деактивация/реактивация (см. WHY у ShopSalaryRule.isActive) — та
    // же прямая мутация props, что и у ShopMotivationSchema.rename().
    deactivate(): void {
        this.props.isActive = false;
    }

    activate(): void {
        this.props.isActive = true;
    }

    // split-task-completion-rule-form — задача этим билдером НЕ создаётся: config.taskIdByPeriod
    // строится пустым (или унаследованным от existingTaskIdByPeriod при restore()),
    // CreateShopSalaryRuleHandler сам создаёт задачу через CommandBus и дописывает её id в уже
    // построенный config.taskIdByPeriod ПОСЛЕ этого вызова (см. WHY у CreateShopSalaryRuleHandler)
    // — buildConfig() остаётся чистой функцией без IO.
    static create(rule: CreateShopSalaryRuleProps): TaskCompletionShop {
        return new TaskCompletionShop({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: TaskCompletionShop.buildConfig(rule.config, {}),
                isActive: true,
            },
        });
    }

    // PATCH .../motivation-schema/:id (UpdateShopMotivationSchemaHandler) —
    // правило, СОВПАВШЕЕ по id со старым (то же самое правило,
    // отредактированное на месте, не пересозданное заново): в отличие от
    // ShopSalaryRuleFactory.restore(), используемого остальными типами
    // правил (запрос и персистентная форма конфига у них совпадают),
    // TaskCompletion обязан ЯВНО слить новый taskId (текущего периода) с
    // УЖЕ существующей картой taskIdByPeriod прежних периодов — иначе
    // правка правила стирала бы историю задач прошлых периодов регулярного
    // правила (design.md решение 2: "правило хранит связь само").
    static restore(
        id: string,
        rule: CreateShopSalaryRuleProps,
        existing: TaskCompletionShop,
    ): TaskCompletionShop {
        return new TaskCompletionShop({
            id,
            props: {
                name: rule.name,
                type: 'TaskCompletion',
                targetRole: rule.targetRole,
                config: TaskCompletionShop.buildConfig(
                    rule.config,
                    existing.config.taskIdByPeriod,
                ),
                // isActive не редактируется этой формой — переносится с
                // сохранившегося правила as is (см. WHY у
                // UpdateShopMotivationSchemaHandler про фильтр oldRules по
                // isActive перед diff'ом).
                isActive: existing.isActive,
            },
        });
    }

    // split-task-completion-rule-form — зеркало buildTaskCompletionConfig направления service:
    // rule.config приходит в форме wire-запроса (TaskCompletionShopSalaryConfigRequest,
    // дискриминированной по isRecurring), НЕ создаёт задачу и не пишет taskId — CreateShopSalaryRuleHandler
    // делает это отдельной мутацией результата ПОСЛЕ вызова create()/restore() (см. их WHY).
    private static buildConfig(
        requestConfig: unknown,
        existingTaskIdByPeriod: Record<string, string>,
    ): TaskCompletionShopSalaryConfig {
        const config = requestConfig as
            | {
                  isRecurring: false;
                  defaultAmount: number;
                  accountingPeriod: string;
              }
            | {
                  isRecurring: true;
                  taskTitleTemplate: string;
                  taskDescriptionTemplate?: string;
                  deadlineTemplate: string;
                  // Опционально в этой транзитной wire-форме (в отличие от домена, где поле
                  // обязательное) — контракт уже задаёт `.default(0)` на границе HTTP, но здесь, на
                  // границе самого домена, отсутствие поля тоже трактуется как 0, а не как ошибка —
                  // тот же дефолт, что и для легаси-строк БД (ShopSalaryRuleMapper.toDomain).
                  deadlinePeriodOffset?: number;
                  taskLinkTemplates?: { url: string; label?: string }[];
                  defaultAmount: number;
                  accountingPeriod: string;
              };

        // add-task-salary-rule-accounting-period, design.md решение 2 —
        // зеркало buildTaskCompletionConfig направления service: период
        // больше не вычисляется скрыто как Period.current(), а приходит из
        // запроса (значение, выбранное руководителем в форме). Period.create(...)
        // валидирует формат и бросает исключение домена при некорректном значении.
        const period = Period.create(config.accountingPeriod).getValue();
        const taskIdByPeriod = { ...existingTaskIdByPeriod };

        if (!config.isRecurring) {
            return {
                taskIdByPeriod,
                defaultAmount: config.defaultAmount,
                accountingPeriod: period,
                isRecurring: false,
            };
        }

        // recurring-task-deadline-offset, design.md решение 1/3 — валидация
        // транзитная (по образцу ProductSoldEntity.validate(), дёргающего
        // FloatPercentSchedule.create()): DeadlinePeriodOffset.create()
        // бросает ArgumentInvalidException на невалидном значении (не целое,
        // вне 0..3), а само значение в config сохраняется как обычное
        // число — этот VO нигде не персистируется.
        const deadlinePeriodOffset = config.deadlinePeriodOffset ?? 0;
        DeadlinePeriodOffset.create(deadlinePeriodOffset);

        return {
            taskIdByPeriod,
            defaultAmount: config.defaultAmount,
            accountingPeriod: period,
            isRecurring: true,
            taskTitleTemplate: config.taskTitleTemplate,
            taskDescriptionTemplate: config.taskDescriptionTemplate,
            deadlineTemplate: config.deadlineTemplate,
            deadlinePeriodOffset,
            taskLinkTemplates: config.taskLinkTemplates ?? [],
        };
    }

    // spec: shop/accounting#requirement-сумма-начисления-по-правилу-за-выполнение-задачи-задаётся-руководителем-вручную
    //
    // Implements FR1-FR3 of task-completion-progressive-visibility: null
    // остаётся только когда задача этого периода вообще не заведена — раз
    // заведена, строка присутствует в ОБОИХ проходах (FACT/PROGNOSE).
    // PROGNOSE = config.defaultAmount СРАЗУ, вне зависимости от статуса
    // задачи. FACT = 0, пока задача не достигла статуса «Выполнена»
    // (ShopSalaryTask.isFactAccrued(), не запросом к tasks из самого
    // правила, см. backend/CLAUDE.md — domain не имеет доступа к IO; сумма
    // не откатывается автоматически при доработке/неуспешном закрытии).
    // requiresManualInput ВСЕГДА true — при закрытии периода руководитель
    // по-прежнему обязан подтвердить сумму и вправе уменьшить её с
    // обязательным комментарием, если по факту сделано меньше: действующая
    // сумма живёт только на ShopSalaryAccrualLine (design.md Decision 5),
    // calculate() её не читает и не пересчитывает.
    calculate(context: ShopCalculationContext): CalculationLine | null {
        const erpData = context.erpData as ShopCalculationErpData | undefined;
        const salaryTask = erpData?.taskCompletionStatuses?.[this.id];

        if (!salaryTask) {
            return null;
        }

        const amount =
            context.mode === 'FACT'
                ? salaryTask.isFactAccrued()
                    ? this.props.config.defaultAmount
                    : 0
                : this.props.config.defaultAmount;

        return {
            ruleId: this.id,
            amount,
            requiresManualInput: true,
            sources: this.buildSources(salaryTask.taskId),
        };
    }

    // spec: shop/accounting#requirement-детализация-строки-задача-и-ссылка-на-неё
    //
    // label — config.taskTitleTemplate, ТОЛЬКО у регулярного правила (единственный локально
    // известный заголовок — шаблон авто-пересоздания). У разового правила config не хранит
    // буквальный заголовок задачи вовсе (split-task-completion-rule-form — одноразовый вход, см.
    // WHY у TaskCompletionShopSalaryConfig), поэтому label отсутствует — человекочитаемое название
    // такой строки источника читается через саму задачу (link ниже), не через правило.
    // link — внутренняя страница задачи iReports (модуль tasks), не Bitrix24
    // (интеграция удалена целиком, design.md решение 1).
    private buildSources(taskId: string) {
        return [
            {
                type: 'taskCompletion',
                id: taskId,
                ...(this.props.config.isRecurring
                    ? { label: this.props.config.taskTitleTemplate }
                    : {}),
                link: `/tasks/${taskId}`,
            },
        ];
    }

    // recurring-task-deadline-offset — вызывается автоматически
    // конструктором Entity (entity.base.ts) и при чтении из БД
    // (ShopSalaryRuleMapper.toDomain), и при create()/restore() (см.
    // buildConfig() выше, откуда validate() вызывается повторно —
    // безвредно, DeadlinePeriodOffset.create() идемпотентна): тот же
    // fail-closed приём, что и у ProductSoldEntity.validate()
    // (FloatPercentSchedule.create()) — невалидное значение в БД не должно
    // молча уходить в расчёт дедлайна.
    validate(): void {
        // split-task-completion-rule-form — deadlinePeriodOffset существует только у регулярного
        // правила (TaskCompletionShopSalaryConfig, discriminatedUnion по isRecurring); у разового
        // проверять нечего, тот же narrowing, что и в buildSources() выше.
        if (this.props.config.isRecurring) {
            DeadlinePeriodOffset.create(this.props.config.deadlinePeriodOffset);
        }
    }
}
