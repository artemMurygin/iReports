// Read-порт над уже существующим справочником MoySkladProductFolder — без бизнес-инвариантов,
// никаких write-методов (справочник наполняется синком MoySklad, не этим модулем). Единственный
// сегодняшний метод отдаёт не весь справочник (как service-версия ProductCategoryRepositoryPort),
// а только id настоящих корневых категорий (parentId IS NULL) — design.md Decision 6a
// (add-department-head-salary-rules, FR5): это всё, что нужно GetGoodsTurnoverReportService для
// построения totals, и дешевле полного дерева (GetCatalogService.getTree()).
export interface ProductCategoryRepositoryPort {
    /** Implements FR5 of add-department-head-salary-rules. */
    findRootIds(): Promise<Set<string>>;
}

export const PRODUCT_CATEGORY_REPOSITORY = Symbol(
    'PRODUCT_CATEGORY_REPOSITORY',
);
