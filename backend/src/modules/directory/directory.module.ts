import { Module } from '@nestjs/common';
import { ListDepartmentsService } from './application/services/list-departments.service';
import { ListEmployeesService } from './application/services/list-employees.service';
import { DIRECTORY_REPOSITORY } from './application/ports/directory.port';
import { DirectoryRepository } from './infrastructure/repositories/directory.repository';
import { ListDepartmentsHttpController } from './interface/http-controllers/list-departments.http.controller';
import { ListEmployeesHttpController } from './interface/http-controllers/list-employees.http.controller';

// Справочник отделов/сотрудников Bitrix (Фаза 1,
// docs/salary-schema-creation-ui/plan-salary-schema-creation-ui.md) — питает
// селекты «Отдел»/«Сотрудник» на Шаге 1 формы создания зарплатной схемы.
// Модуль намеренно не вложен ни в domains/service, ни в domains/shop:
// BitrixDepartment/BitrixEmployee не принадлежат ни одному бизнес-
// направлению — тот же принцип, что и у modules/employee-identity, поэтому
// он живёт на уровне src/modules, а не под domains/*. Read-only (нет
// команд/событий), поэтому CqrsModule не импортируется.
@Module({
    controllers: [ListDepartmentsHttpController, ListEmployeesHttpController],
    providers: [
        ListDepartmentsService,
        ListEmployeesService,
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
