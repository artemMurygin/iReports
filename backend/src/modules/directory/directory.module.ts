import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ListDepartmentsService } from './application/services/list-departments.service';
import { ListEmployeesService } from './application/services/list-employees.service';
import { ListEmployeesWithServiceAccountService } from './application/services/list-employees-with-service-account.service';
import { DIRECTORY_REPOSITORY } from './application/ports/directory.port';
import { DirectoryRepository } from './infrastructure/repositories/directory.repository';
import { ListDepartmentsHttpController } from './interface/http-controllers/list-departments.http.controller';
import { ListEmployeesHttpController } from './interface/http-controllers/list-employees.http.controller';
import { ListEmployeesWithServiceAccountHttpController } from './interface/http-controllers/list-employees-with-service-account.http.controller';
import { ReorderEmployeesHttpController } from './interface/http-controllers/reorder-employees.http.controller';
import { ReorderEmployeesHandler } from './application/command/reorder-employees.handler';
import { SetEmployeeServiceAccountHttpController } from './interface/http-controllers/set-employee-service-account.http.controller';
import { SetEmployeeServiceAccountHandler } from './application/command/set-employee-service-account.handler';

// Справочник отделов/сотрудников Bitrix (Фаза 1,
// docs/salary-schema-creation-ui/plan-salary-schema-creation-ui.md) — питает
// селекты «Отдел»/«Сотрудник» на Шаге 1 формы создания зарплатной схемы.
// Модуль намеренно не вложен ни в domains/service, ни в domains/shop:
// BitrixDepartment/BitrixEmployee не принадлежат ни одному бизнес-
// направлению — тот же принцип, что и у modules/employee-identity, поэтому
// он живёт на уровне src/modules, а не под domains/*. CqrsModule
// импортирован ради ReorderEmployeesHandler (docs/employee-ordering-and-salary-filter,
// Фаза 1) и SetEmployeeServiceAccountHandler (там же, Фаза 3) — единственные
// две команды модуля, остальное по-прежнему read-only DI-сервисы.
@Module({
    imports: [CqrsModule],
    controllers: [
        ListDepartmentsHttpController,
        ListEmployeesHttpController,
        ListEmployeesWithServiceAccountHttpController,
        ReorderEmployeesHttpController,
        SetEmployeeServiceAccountHttpController,
    ],
    providers: [
        ListDepartmentsService,
        ListEmployeesService,
        ListEmployeesWithServiceAccountService,
        ReorderEmployeesHandler,
        SetEmployeeServiceAccountHandler,
        {
            provide: DIRECTORY_REPOSITORY,
            useClass: DirectoryRepository,
        },
    ],
    // Экспорт токена — иначе AccountingModule/ShopAccountingModule не могут
    // инжектить DIRECTORY_REPOSITORY для резолвинга target.name в
    // ListMotivationSchemasService/GetMotivationSchemaService (см.
    // apiDesign плана "Редактирование зарплатных схем").
    exports: [DIRECTORY_REPOSITORY],
})
export class DirectoryModule {}
