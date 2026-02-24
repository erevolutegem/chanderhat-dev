"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrencyController = exports.OwnerController = void 0;
const common_1 = require("@nestjs/common");
const owner_service_1 = require("./owner.service");
const currency_service_1 = require("./currency.service");
let OwnerController = class OwnerController {
    ownerService;
    currencyService;
    constructor(ownerService, currencyService) {
        this.ownerService = ownerService;
        this.currencyService = currencyService;
    }
    async getSites() {
        const mockOwnerId = 1;
        return this.ownerService.getSitesByOwner(mockOwnerId);
    }
    async getStats() {
        const mockOwnerId = 1;
        return this.ownerService.getOwnerStats(mockOwnerId);
    }
    async setupCurrency(data) {
        return this.currencyService.setSiteCurrency(data.siteId, data.currencyId, data.isDefault);
    }
};
exports.OwnerController = OwnerController;
__decorate([
    (0, common_1.Get)('sites'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OwnerController.prototype, "getSites", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], OwnerController.prototype, "getStats", null);
__decorate([
    (0, common_1.Post)('currency/setup'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OwnerController.prototype, "setupCurrency", null);
exports.OwnerController = OwnerController = __decorate([
    (0, common_1.Controller)('v1/owner'),
    __metadata("design:paramtypes", [owner_service_1.OwnerService,
        currency_service_1.CurrencyService])
], OwnerController);
let CurrencyController = class CurrencyController {
    currencyService;
    constructor(currencyService) {
        this.currencyService = currencyService;
    }
    async list() {
        return this.currencyService.getAllCurrencies();
    }
    async create(data) {
        return this.currencyService.createCurrency(data.code, data.symbol, data.rate);
    }
};
exports.CurrencyController = CurrencyController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CurrencyController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CurrencyController.prototype, "create", null);
exports.CurrencyController = CurrencyController = __decorate([
    (0, common_1.Controller)('v1/currencies'),
    __metadata("design:paramtypes", [currency_service_1.CurrencyService])
], CurrencyController);
//# sourceMappingURL=owner.controller.js.map