import { Module } from '@nestjs/common';
import { ListShopSalaryRuleTypesService } from '@/domains/shop/modules/accounting/application/services/list-salary-rule-types.service';
import { ListShopSalaryRuleTypesHttpController } from '@/domains/shop/modules/accounting/interface/http-controllers/list-salary-rule-types.http.controller';

// Модуль accounting магазина (Фаза 12, issue #57) — собственный реестр
// (shopSalaryRuleRegistry) и фабрика (ShopSalaryRuleFactory) правил
// PayPerHour/ProductSold, независимые от одноимённого модуля сервиса (см.
// domains/service/modules/accounting/accounting.module.ts) — ни один класс
// оттуда здесь не импортируется.
//
// Единственный HTTP-вход этой фазы — список типов правил
// (GET /shop/accounting/salary_role_types, issue #61). Персистентность
// (создание мотивационной схемы/правила магазина, свои
// SalaryRuleRepository/MotivationSchemaRepository) сознательно не входит
// в Фазу 12/13 — ни один из issues 57-66 не требует HTTP-эндпоинта записи
// для направления shop; расчёт правил (ProductSoldEntity.calculate() и
// т.п.) уже полностью готов принять CalculationContext, когда появится
// оркестратор, который его соберёт (см. shop-calculation-data.types.ts).
@Module({
    controllers: [ListShopSalaryRuleTypesHttpController],
    providers: [ListShopSalaryRuleTypesService],
})
export class ShopAccountingModule {}
