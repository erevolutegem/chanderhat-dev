"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("@nestjs/axios");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const events_gateway_1 = require("./events.gateway");
const bets_api_service_1 = require("./bets-api.service");
const games_controller_1 = require("./games.controller");
const live_scores_service_1 = require("./live-scores.service");
const prisma_service_1 = require("./prisma.service");
const site_service_1 = require("./site.service");
const site_controller_1 = require("./site.controller");
const owner_service_1 = require("./owner.service");
const owner_controller_1 = require("./owner.controller");
const currency_service_1 = require("./currency.service");
const owner_controller_2 = require("./owner.controller");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const jwt_guard_1 = require("./jwt.guard");
const bets_service_1 = require("./bets.service");
const bets_controller_1 = require("./bets.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
            axios_1.HttpModule,
        ],
        controllers: [
            app_controller_1.AppController,
            games_controller_1.GamesController,
            site_controller_1.SiteController,
            owner_controller_1.OwnerController,
            owner_controller_2.CurrencyController,
            auth_controller_1.AuthController,
            bets_controller_1.BetsController,
        ],
        providers: [
            app_service_1.AppService,
            events_gateway_1.EventsGateway,
            bets_api_service_1.BetsApiService,
            live_scores_service_1.LiveScoresService,
            prisma_service_1.PrismaService,
            site_service_1.SiteService,
            owner_service_1.OwnerService,
            currency_service_1.CurrencyService,
            auth_service_1.AuthService,
            jwt_guard_1.JwtGuard,
            bets_service_1.BetsService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map