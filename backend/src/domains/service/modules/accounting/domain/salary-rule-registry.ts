import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import {
    SalaryRuleClass,
    SalaryRuleTypes,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { ServiceCompletedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/service-completed.entity';
import { OrderPayedEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/order-payed.entity';

export const salaryRuleRegistry = new Map<SalaryRuleTypes, SalaryRuleClass>([
    ['PayPerHour', PayPerHoursEntity],
    ['ServiceCompleted', ServiceCompletedEntity],
    ['OrderPayed', OrderPayedEntity],
]);
