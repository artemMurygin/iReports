import { Module } from '@nestjs/common';
import { ListShopSalaryRuleTypesService } from '@/domains/shop/modules/accounting/application/services/list-salary-rule-types.service';
import { ListShopSalaryRuleTypesHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-salary-rule-types.http.controller';

// Модуль accounting магазина (Фаза 12/13, issue #57/#64) — собственный
// реестр (shopSalaryRuleRegistry) и фабрика (ShopSalaryRuleFactory) правил
// PayPerHour/ProductSold/UsedProductSold/TaskCompleted, независимые от
// одноимённого модуля сервиса (см.
// domains/service/modules/accounting/accounting.module.ts) — ни один класс
// оттуда здесь не импортируется.
//
// Единственный HTTP-вход этих фаз — список типов правил
// (GET /shop/accounting/salary_role_types, issue #61). Персистентность
// (создание мотивационной схемы/правила магазина, свои
// SalaryRuleRepository/MotivationSchemaRepository) и оркестратор, реально
// собирающий CalculationContext из БД для направления shop (см.
// BuildShopCalculationContextService, упомянутый, но не реализованный в
// shop-calculation-data.types.ts) — СОЗНАТЕЛЬНО остаются вне Фазы 12/13:
// ни один из issues 57-66 не требует ни HTTP-эндпоинта записи, ни
// эндпоинта отчёта по зарплате для направления shop; расчёт правил
// (ProductSoldEntity.calculate()/UsedProductSoldEntity.calculate()/...)
// уже полностью готов принять CalculationContext, когда появится
// оркестратор, который его соберёт. ВАЖНО для дальнейшей работы: Фаза 16
// плана (мотивационные схемы — UI) и Фаза 18 (отчёты по зарплате — UI) не
// содержат собственных backend-задач — предполагается, что оба этих пути
// (запись и отчёт) для shop уже готовы к их началу. Эта пара, таким
// образом, остаётся явным, задокументированным пробелом: следующая
// backend-фаза перед стартом Фазы 16/18 обязана реализовать
// BuildShopCalculationContextService + ShopCalculationDataRepository (по
// образцу BuildServiceCalculationContextService/
// ServiceCalculationDataRepository сервиса) и независимые
// CreateMotivationSchema/CreateSalaryRule/GetEmployeeSalaryReport/
// GetDepartmentSalaryReport для shop (не переиспользующие сервисные
// хендлеры — issue #57).
@Module({
    controllers: [ListShopSalaryRuleTypesHttpController],
    providers: [ListShopSalaryRuleTypesService],
})
export class ShopAccountingModule {}
