"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var core_1 = require("@nestjs/core");
var schedule_1 = require("@nestjs/schedule");
var event_emitter_1 = require("@nestjs/event-emitter");
var nestjs_request_context_1 = require("nestjs-request-context");
var logger_middleware_1 = require("./shared/logger.middleware");
var ContextInterceptor_1 = require("./shared/application/context/ContextInterceptor");
var database_module_1 = require("./infrustructure/database/database.module");
var bitrix_module_1 = require("./integrations/bitrix/bitrix.module");
var ai_module_1 = require("./integrations/ai/ai.module");
var google_sheets_module_1 = require("./integrations/google-sheets/google-sheets.module");
var roapp_module_1 = require("./domains/service/integrations/roapp/roapp.module");
var custom_api_roapp_module_1 = require("./domains/service/integrations/custom-api-roapp/custom-api-roapp.module");
var moysklad_module_1 = require("./domains/shop/integrations/moySklad/moysklad.module");
var bitrix_sync_module_1 = require("./sync/bitrix/bitrix-sync.module");
var sales_module_1 = require("./domains/service/modules/sales/sales.module");
var roapp_sync_module_1 = require("./domains/service/sync/roapp/roapp-sync.module");
var moysklad_sync_module_1 = require("./domains/shop/sync/moySklad/moysklad-sync.module");
var accounting_module_1 = require("./domains/service/modules/accounting/accounting.module");
// TODO: временно перенесены как есть, требуют рефакторинга под DDD:
var priceMonitoring_module_1 = require("./TODO/priceMonitoring/priceMonitoring.module");
var deals_module_1 = require("./TODO/deals/deals.module");
var reports_module_1 = require("./TODO/reports/reports.module");
// TODO: не мигрировано в src1 (эквивалента ещё нет):
// import { CronModule } from './cron/cron.module';
// import { SalaryModule } from './salary/salary.module';
var AppModule = function () {
    var _classDecorators = [(0, common_1.Module)({
            imports: [
                database_module_1.DatabaseModule,
                bitrix_module_1.BitrixModule,
                roapp_module_1.RoappModule,
                custom_api_roapp_module_1.CustomApiRoappModule,
                schedule_1.ScheduleModule.forRoot(),
                event_emitter_1.EventEmitterModule.forRoot(),
                bitrix_sync_module_1.BitrixSyncModule,
                roapp_sync_module_1.RoappSyncModule,
                sales_module_1.SalesModule,
                accounting_module_1.AccountingModule,
                ai_module_1.AiModule,
                google_sheets_module_1.GoogleSheetsModule,
                moysklad_module_1.MoyskladModule,
                moysklad_sync_module_1.MoySkladSyncModule,
                // TODO: временно перенесены как есть, требуют рефакторинга под DDD:
                priceMonitoring_module_1.PriceMonitoringModule,
                deals_module_1.DealsModule,
                reports_module_1.ReportsModule,
                // TODO: не мигрировано в src1 (эквивалента ещё нет):
                // CronModule,
                // SalaryModule,
            ],
            providers: [
                {
                    provide: core_1.APP_INTERCEPTOR,
                    useClass: ContextInterceptor_1.ContextInterceptor,
                },
            ],
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AppModule = _classThis = /** @class */ (function () {
        function AppModule_1() {
        }
        AppModule_1.prototype.configure = function (consumer) {
            // RequestContextMiddleware должен отработать первым, чтобы
            // AsyncLocalStorage-контекст был доступен во всех последующих
            // middleware/interceptors/controllers этого запроса.
            consumer
                .apply(nestjs_request_context_1.RequestContextMiddleware, logger_middleware_1.LoggerMiddleware)
                .forRoutes('*');
        };
        return AppModule_1;
    }());
    __setFunctionName(_classThis, "AppModule");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
}();
exports.AppModule = AppModule;
