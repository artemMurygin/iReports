import { randomUUID } from 'crypto';
import { AggregateID, Entity } from '@/shared/domain/entity.base';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import {
    CreateSalaryRuleProps,
    SalaryRule,
    TargetRole,
    TaskCompletedActualAmountEntry,
    TaskCompletedRuleStatus,
    TaskCompletedSalaryConfig,
    TaskCompletedSalaryRule,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import type {
    BitrixTaskRuleStatusItem,
    ServiceCalculationErpData,
} from '@/domains/service/modules/accounting/domain/types/service-calculation-data.types';
import { TaskRewardAmount } from '@/domains/service/modules/accounting/domain/value-objects/task-reward-amount.value-object';
import { TaskRuleAlreadyArchivedException } from '@/domains/service/modules/accounting/domain/exceptions/task-rule.exception';

// Правило "вознаграждение за выполненную задачу" (change
// salary-rule-bitrix-task, см. docs/salary-rule-bitrix-task/
// prd-salary-rule-bitrix-task.md). Постановка, обсуждение и приёмка задачи
// идут в Bitrix24; iReports хранит в правиле только накопленные
// bitrixTaskIds (design.md, Decision 1) и по ним пакетно (не по одному
// запросу на правило, см. BitrixTasksService.getTasksBatch) читает статус и
// текущий расчётный месяц задачи — уже нормализованные application-слоем в
// context.erpData.bitrixTaskStatuses (см. service-calculation-data.types.ts).
// Расчёт НЕ читает временный воркфлоу TaskCompletion
// (confirmedTaskCompletions) — он выведен из эксплуатации этим же change'ем
// (spec.md, "Вывод из эксплуатации воркфлоу TaskCompletion"); доменная
// сущность TaskCompletion и её удаление — отдельная, отложенная задача 5.3.
//
// Роль правила (targetRole) здесь НЕ фильтрует выборку — правило-задача
// привязано к конкретной задаче Bitrix24, а не к множеству ERP-записей
// сотрудника; targetRole остаётся обязательным полем контракта (общая часть
// формы правила для всех типов) и используется только для
// группировки/отображения в UI.
export class TaskCompletedEntity
    extends Entity<TaskCompletedSalaryRule>
    implements SalaryRule
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

    get config(): TaskCompletedSalaryConfig {
        return this.props.config;
    }

    // Единственный вид вознаграждения — фиксированная сумма (design.md,
    // Decision 2), value object (backend/CLAUDE.md, "Value objects") — у
    // суммы есть собственный инвариант (неотрицательное конечное число),
    // проверяемый validate() при любом пути создания сущности, не только на
    // HTTP-границе.
    get rewardAmount(): TaskRewardAmount {
        return TaskRewardAmount.create(this.props.config.rewardAmount);
    }

    // ID задач Bitrix24 правила, в порядке добавления (design.md change
    // salary-rule-bitrix-task, Decision 1) — один на разовое правило, по
    // одному на каждый регенерированный месяц регулярного.
    get bitrixTaskIds(): number[] {
        return this.props.config.bitrixTaskIds ?? [];
    }

    get actualAmounts(): TaskCompletedActualAmountEntry[] {
        return this.props.config.actualAmounts ?? [];
    }

    // См. WHY у TaskCompletedRuleStatus (salary-rule.types.ts) — имеет
    // смысл только при isRecurring: false. Дефолт 'ACTIVE' в геттере, а не
    // только в zod-схеме контракта — правила, восстановленные из БД до этой
    // фичи (props без поля status), не должны падать/трактоваться как
    // заархивированные (docs/task-rule-archiving-and-links, "Технические
    // ограничения").
    get status(): TaskCompletedRuleStatus {
        return this.props.config.status ?? 'ACTIVE';
    }

    static create(rule: CreateSalaryRuleProps): TaskCompletedEntity {
        return new TaskCompletedEntity({
            id: randomUUID(),
            props: {
                name: rule.name,
                type: 'TaskCompleted',
                targetRole: rule.targetRole,
                config: rule.config as TaskCompletedSalaryConfig,
            },
        });
    }

    // Прогноз — полная сумма правила для любой задачи из bitrixTaskIds, чей
    // ТЕКУЩИЙ расчётный месяц (в Bitrix24) совпадает с отчётным периодом,
    // независимо от статуса (spec.md, "Расчёт факта и прогноза..."). Факт —
    // только когда эта же задача в статусе "Закрыта" (COMPLETED):
    // фактическая сумма за период, если руководитель её указал, иначе та же
    // полная сумма. Недоступная задача (удалена/нет прав/тег периода не
    // распознан) или задача, чей месяц не совпадает ни с одним периодом
    // выборки, не даёт начисления совсем — 0 в обоих режимах (spec.md,
    // "Обработка недоступной задачи").
    calculate(context: CalculationContext): CalculationLine {
        const erpData = context.erpData as
            ServiceCalculationErpData | undefined;
        const statusesByTaskId = new Map(
            (erpData?.bitrixTaskStatuses ?? []).map(
                (item) => [item.id, item] as const,
            ),
        );

        const matched = this.findTaskForPeriod(
            statusesByTaskId,
            context.period.period,
        );

        if (!matched) {
            return this._buildUnavailableOrIrrelevantLine(statusesByTaskId);
        }

        const rewardAmount = this.rewardAmount.getValue();
        const isClosed = matched.status === 'COMPLETED';
        const factAmount = isClosed
            ? (this._findActualAmount(context.period.period) ?? rewardAmount)
            : 0;
        const amount = context.mode === 'FACT' ? factAmount : rewardAmount;

        return {
            ruleId: this.id,
            quantity: amount > 0 ? 1 : 0,
            rate: rewardAmount,
            amount,
            sources:
                amount > 0
                    ? [{ type: 'bitrixTask', id: matched.id, amount }]
                    : [],
            taskStatus: matched.status,
        };
    }

    // Полный перебор всех накопленных bitrixTaskIds (design.md, Decision 1:
    // "запрашивает статус... для всех bitrixTaskIds... и на месте отбирает
    // задачу, чей текущий месяц равен P") — а не только последнего
    // элемента, чтобы регулярное правило с несколькими накопленными за
    // историю задачами корректно находило именно ту, что относится к
    // запрошенному периоду отчёта.
    //
    // Публичный — переиспользуется вне calculate() application-слоем
    // (SetTaskRuleActualAmountHandler, задача 6.4 change
    // salary-rule-bitrix-task: нужно знать статус задачи ИМЕННО за
    // запрошенный period, прежде чем разрешить ручной ввод фактической
    // суммы; ListUnclosedTaskRulesForPeriodService, задача 6.6 — тот же
    // вопрос для списка незакрытых задач перед закрытием периода), чтобы не
    // дублировать этот перебор вне сущности.
    findTaskForPeriod(
        statusesByTaskId: Map<number, BitrixTaskRuleStatusItem>,
        period: string,
    ): BitrixTaskRuleStatusItem | undefined {
        for (const taskId of this.bitrixTaskIds) {
            const item = statusesByTaskId.get(taskId);
            if (item?.isAvailable && item.period === period) {
                return item;
            }
        }
        return undefined;
    }

    // Ни одна из накопленных задач не относится к запрошенному периоду —
    // либо потому что "текущая" (последняя добавленная) задача правила
    // недоступна/у неё не распознан тег периода (spec.md, "Обработка
    // недоступной задачи" — в этом случае помечаем правило как
    // isUnavailable), либо потому что она вполне доступна, но относится к
    // другому месяцу (перенесена руководителем, спереди/сзади запрошенного
    // периода — spec.md, "Перенос задачи на следующий расчётный месяц"; тут
    // начисления по правилу для этого периода просто нет, без пометки
    // недоступности). "Последняя добавленная" — это единственная задача,
    // которую руководитель считает актуальной для правила прямо сейчас
    // (bitrixTaskIds — накопительный лог, см. addBitrixTaskId).
    private _buildUnavailableOrIrrelevantLine(
        statusesByTaskId: Map<number, BitrixTaskRuleStatusItem>,
    ): CalculationLine {
        return {
            ruleId: this.id,
            quantity: 0,
            rate: this.rewardAmount.getValue(),
            amount: 0,
            sources: [],
            isUnavailable: this.isCurrentTaskUnavailable(statusesByTaskId),
        };
    }

    // "Недоступность" последней добавленной задачи правила (см. WHY у
    // _buildUnavailableOrIrrelevantLine) — публичный, тем же приёмом и по
    // той же причине, что и findTaskForPeriod выше: переиспользуется
    // ListUnclosedTaskRulesForPeriodService (задача 6.6 change
    // salary-rule-bitrix-task), которому нужно показать в списке незакрытых
    // задач периода и правила, чья текущая задача недоступна, а не только
    // те, чья задача есть, но не "Закрыта".
    isCurrentTaskUnavailable(
        statusesByTaskId: Map<number, BitrixTaskRuleStatusItem>,
    ): boolean {
        const currentTaskId = this.bitrixTaskIds[this.bitrixTaskIds.length - 1];
        const currentTask =
            currentTaskId !== undefined
                ? statusesByTaskId.get(currentTaskId)
                : undefined;
        return (
            !currentTask ||
            !currentTask.isAvailable ||
            currentTask.period === null
        );
    }

    private _findActualAmount(period: string): number | undefined {
        return this.actualAmounts.find((entry) => entry.period === period)
            ?.amount;
    }

    // Вызывается после успешного createTask в Bitrix24 (application-слой,
    // задача 6.2) — добавляет новый ID к уже накопленным, не заменяет их
    // (design.md, Decision 1: bitrixTaskIds — накопительный список).
    addBitrixTaskId(taskId: number): void {
        this.props.config.bitrixTaskIds = [...this.bitrixTaskIds, taskId];
        this.validate();
    }

    // Upsert по period: повторный вызов для того же периода заменяет
    // ранее сохранённое значение, а не добавляет вторую запись (design.md,
    // Decision 2 — "Ручной ввод фактической суммы", spec.md сценарий
    // "Изменение суммы в открытом месяце пересчитывает факт").
    upsertActualAmount(period: string, amount: number): void {
        const existingIndex = this.actualAmounts.findIndex(
            (entry) => entry.period === period,
        );
        const next = [...this.actualAmounts];
        if (existingIndex === -1) {
            next.push({ period, amount });
        } else {
            next[existingIndex] = { period, amount };
        }
        this.props.config.actualAmounts = next;
        this.validate();
    }

    // Разовое (isRecurring: false) правило-задача архивируется
    // автоматически, как только закрывается расчётный период, к которому
    // относится dueDate — независимо от того, была задача выполнена в
    // Bitrix24 или дедлайн прошёл без выполнения (docs/task-rule-archiving-and-links,
    // Фаза 1; см. ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler). Архив
    // необратим — повторный вызов на уже ARCHIVED правиле бросает
    // исключение, тем же паттерном enum-статуса с методом-переходом, что
    // AccountingPeriod.close()/TaskCompletion.confirm()/reject() (см.
    // backend/CLAUDE.md, "Value objects"/раздел про мягкое удаление): в
    // проекте переход из терминального состояния — ошибка, а не
    // идемпотентный no-op.
    archive(): void {
        if (this.status === 'ARCHIVED') {
            throw new TaskRuleAlreadyArchivedException(this.id);
        }
        this.props.config.status = 'ARCHIVED';
        this.validate();
    }

    // Совпадает ли месяц dueDate ('YYYY-MM-DD') с расчётным периодом
    // ('YYYY-MM') — используется ArchiveOneTimeTaskRulesOnPeriodClosedEventHandler
    // для отбора правил, относящихся к закрываемому периоду (PRD: "чей
    // dueDate относится к закрываемому периоду"), без завязки на текущий
    // (живой, потенциально перенесённый в Bitrix24) расчётный месяц задачи.
    isDueInPeriod(period: string): boolean {
        return this.props.config.dueDate.startsWith(period);
    }

    validate(): void {
        // Бросает ArgumentInvalidException при отрицательной/нечисловой
        // сумме — тот же инвариант, что и на HTTP-границе
        // (taskCompletedSalaryConfigSchema.rewardAmount), но проверяемый и
        // при восстановлении правила из БД (SalaryRuleMapper.toDomain).
        TaskRewardAmount.create(this.props.config.rewardAmount);
    }
}
