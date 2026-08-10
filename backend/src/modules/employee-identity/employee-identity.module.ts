import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BitrixAuthModule } from '@/integrations/bitrix/auth/bitrix-auth.module';
import { CreateEmployeeIdentityHandler } from './application/command/create-employee-identity.handler';
import { UpdateEmployeeIdentityHandler } from './application/command/update-employee-identity.handler';
import { DeleteEmployeeIdentityHandler } from './application/command/delete-employee-identity.handler';
import { ListEmployeeIdentitiesService } from './application/services/list-employee-identities.service';
import { ListUnmatchedEmployeesService } from './application/services/list-unmatched-employees.service';
import { ResolveEmployeeByExternalIdService } from './application/services/resolve-employee-by-external-id.service';
import { EMPLOYEE_IDENTITY_REPOSITORY } from './application/ports/employee-identity.port';
import { EmployeeIdentityRepository } from './infrastructure/repositories/employee-identity.repository';
import { CreateEmployeeIdentityHttpController } from './interface/http-controllers/create-employee-identity.http.controller';
import { UpdateEmployeeIdentityHttpController } from './interface/http-controllers/update-employee-identity.http.controller';
import { DeleteEmployeeIdentityHttpController } from './interface/http-controllers/delete-employee-identity.http.controller';
import { ListEmployeeIdentitiesHttpController } from './interface/http-controllers/list-employee-identities.http.controller';
import { ListUnmatchedEmployeesHttpController } from './interface/http-controllers/list-unmatched-employees.http.controller';

// Идентификация сотрудника между Bitrix24 / RemOnline / МойСклад (Фаза 2).
// Модуль намеренно не вложен ни в domains/service, ни в domains/shop —
// EmployeeIdentity связывает Bitrix-сотрудника с обеими ERP сразу и не
// принадлежит ни одному бизнес-направлению; по тому же принципу, что и
// BitrixModule/AiModule, он живёт на уровне src/modules, а не под domains/*.
// Слоистость domain → application → infrastructure → interface при этом
// сохраняется (см. backend/CLAUDE.md).
@Module({
    imports: [CqrsModule, BitrixAuthModule],
    controllers: [
        CreateEmployeeIdentityHttpController,
        UpdateEmployeeIdentityHttpController,
        DeleteEmployeeIdentityHttpController,
        ListEmployeeIdentitiesHttpController,
        ListUnmatchedEmployeesHttpController,
    ],
    providers: [
        CreateEmployeeIdentityHandler,
        UpdateEmployeeIdentityHandler,
        DeleteEmployeeIdentityHandler,
        ListEmployeeIdentitiesService,
        ListUnmatchedEmployeesService,
        ResolveEmployeeByExternalIdService,
        {
            provide: EMPLOYEE_IDENTITY_REPOSITORY,
            useClass: EmployeeIdentityRepository,
        },
    ],
    exports: [ResolveEmployeeByExternalIdService],
})
export class EmployeeIdentityModule {}
