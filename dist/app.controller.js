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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const app_service_1 = require("./app.service");
const prisma_service_1 = require("./prisma.service");
const events_gateway_1 = require("./events.gateway");
let AppController = class AppController {
    appService;
    prismaService;
    eventsGateway;
    constructor(appService, prismaService, eventsGateway) {
        this.appService = appService;
        this.prismaService = prismaService;
        this.eventsGateway = eventsGateway;
    }
    getHello() {
        return this.appService.getHello();
    }
    async getHealth() {
        let dbStatus = 'ok';
        try {
            await this.prismaService.$queryRaw `SELECT 1`;
        }
        catch (e) {
            dbStatus = `error: ${e.message}`;
        }
        return {
            status: 'ok',
            build: 'v12.0.0',
            timestamp: new Date().toISOString(),
            services: {
                api: 'ok',
                database: { status: dbStatus, provider: 'postgresql' },
                redis: { mode: 'redis-adapter', status: 'ok' },
                socket: {
                    status: 'ok',
                    connectedClients: this.eventsGateway.getConnectedClients(),
                    namespace: '/live',
                }
            },
        };
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", String)
], AppController.prototype, "getHello", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "getHealth", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        prisma_service_1.PrismaService,
        events_gateway_1.EventsGateway])
], AppController);
//# sourceMappingURL=app.controller.js.map