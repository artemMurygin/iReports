// Структурный, а не конкретный тип, и TRule без ограничения — та же
// причина, что и у MotivationSchemaLike в accounting-cache-freshness.ts:
// домен shop держит собственную (не импортируемую отсюда) мотивационную
// схему с такой же формой getProps() и собственный, несовместимый с
// SalaryRule union типов правил. Склейка двух списков от типа правила не
// зависит вовсе, поэтому оба домена зовут эту функцию каждый со своим.
interface RulesHolder<TRule> {
    getProps(): { rules: TRule[] };
}

// Полный набор зарплатных правил сотрудника — правила схемы его ОТДЕЛА
// (targetType = 'Department') плюс правила его ЛИЧНОЙ схемы
// (targetType = 'Employee').
//
// Обе половины применяются целиком и суммируются: отдел задаёт базу,
// личная схема добавляет надбавки. Совпадение по (type, targetRole) НЕ
// считается конфликтом и ничего не вытесняет — два правила одного типа
// начисляют независимо, ровно как два правила OrderPayed с разными ролями
// внутри одной схемы (см. PeriodCalculationOrchestrator: правила
// независимы и не ссылаются на результаты друг друга).
//
// Порядок — сначала отдел, потом личные: он определяет порядок строк
// разбивки в ответе отчёта (buildSalaryReportRules идёт по этому же
// массиву), и «база сверху, надбавки снизу» читается естественнее.
// Дублей ruleId между половинами быть не может — id правила это uuid.
export function mergeEmployeeSalaryRules<TRule>(
    departmentSchema: RulesHolder<TRule> | null,
    personalSchema: RulesHolder<TRule> | null,
): TRule[] {
    return [
        ...(departmentSchema?.getProps().rules ?? []),
        ...(personalSchema?.getProps().rules ?? []),
    ];
}
