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
var BetsApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BetsApiService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const redis_service_1 = require("./redis.service");
const rxjs_1 = require("rxjs");
let BetsApiService = BetsApiService_1 = class BetsApiService {
    httpService;
    configService;
    redisService;
    logger = new common_1.Logger(BetsApiService_1.name);
    constructor(httpService, configService, redisService) {
        this.httpService = httpService;
        this.configService = configService;
        this.redisService = redisService;
    }
    async getLiveGames(sportId) {
        const apiKey = this.configService.get('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        if (sportId) {
            const cacheKey = `betsapi:live_games:${sportId}`;
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached)
                    return JSON.parse(cached);
            }
            catch (err) { }
            try {
                const response = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`https://api.b365api.com/v1/bet365/inplay`, {
                    params: { token: apiKey, sport_id: sportId }
                }));
                const data = response.data;
                await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 10).catch(() => { });
                return data;
            }
            catch (err) {
                return { success: false, results: [] };
            }
        }
        const mainSports = [1, 3, 13, 18];
        const cacheKeyAll = `betsapi:live_games:all`;
        try {
            const cachedAll = await redisClient.get(cacheKeyAll);
            if (cachedAll)
                return JSON.parse(cachedAll);
        }
        catch (err) { }
        try {
            const results = await Promise.all(mainSports.map(async (id) => {
                const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`https://api.b365api.com/v1/bet365/inplay`, {
                    params: { token: apiKey, sport_id: id }
                })).catch(() => ({ data: { results: [] } }));
                return resp.data.results || [];
            }));
            const flatResults = { success: true, results: results.flat() };
            await redisClient.set(cacheKeyAll, JSON.stringify(flatResults), 'EX', 10).catch(() => { });
            return flatResults;
        }
        catch (err) {
            return { success: false, results: [] };
        }
    }
};
exports.BetsApiService = BetsApiService;
exports.BetsApiService = BetsApiService = BetsApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService,
        redis_service_1.RedisService])
], BetsApiService);
//# sourceMappingURL=bets-api.service.js.map