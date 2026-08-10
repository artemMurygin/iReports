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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainExceptionFilter = void 0;
var common_1 = require("@nestjs/common");
var exception_base_1 = require("./exception.base");
var exeption_api_1 = require("./exeption.api");
var exception_codes_1 = require("./exception.codes");
var CODE_TO_HTTP_STATUS = (_a = {},
    _a[exception_codes_1.ARGUMENT_INVALID] = common_1.HttpStatus.BAD_REQUEST,
    _a[exception_codes_1.ARGUMENT_NOT_PROVIDED] = common_1.HttpStatus.BAD_REQUEST,
    _a[exception_codes_1.ARGUMENT_OUT_OF_RANGE] = common_1.HttpStatus.BAD_REQUEST,
    _a[exception_codes_1.CONFLICT] = common_1.HttpStatus.CONFLICT,
    _a[exception_codes_1.NOT_FOUND] = common_1.HttpStatus.NOT_FOUND,
    _a);
/**
 * Переводит доменные/прикладные ошибки (ExceptionBase и наследники)
 * в HTTP-ответ с корректным статусом. Это единственное место, где
 * доменный `code` знает про HTTP — сами domain/application слои
 * про HttpException ничего не знают и знать не должны.
 */
var DomainExceptionFilter = function () {
    var _classDecorators = [(0, common_1.Catch)(exception_base_1.ExceptionBase)];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var DomainExceptionFilter = _classThis = /** @class */ (function () {
        function DomainExceptionFilter_1() {
        }
        DomainExceptionFilter_1.prototype.catch = function (exception, host) {
            var _a;
            var response = host.switchToHttp().getResponse();
            var status = (_a = CODE_TO_HTTP_STATUS[exception.code]) !== null && _a !== void 0 ? _a : common_1.HttpStatus.INTERNAL_SERVER_ERROR;
            response.status(status).json(new exeption_api_1.ApiErrorResponse({
                statusCode: status,
                message: exception.message,
                error: exception.code,
                correlationId: exception.correlationId,
            }));
        };
        return DomainExceptionFilter_1;
    }());
    __setFunctionName(_classThis, "DomainExceptionFilter");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DomainExceptionFilter = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DomainExceptionFilter = _classThis;
}();
exports.DomainExceptionFilter = DomainExceptionFilter;
