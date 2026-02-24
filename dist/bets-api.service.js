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
        const endpoints = [
            'https://api.betsapi.com/v1/events/inplay',
            'https://api.b365api.com/v1/events/inplay',
            'https://api.betsapi.com/v1/bet365/inplay',
            'https://api.b365api.com/v1/bet365/inplay'
        ];
        this.logger.log(`Fetching matches v8.0. Token: ${apiKey?.substring(0, 5)}...`);
        const cacheKey = sportId ? `betsapi:live_games:${sportId}` : `betsapi:live_games:all`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached)
                return JSON.parse(cached);
        }
        catch (err) { }
        let allResults = [];
        let debugSet = new Set();
        let tokenStatus = "Unknown";
        try {
            try {
                const check = await (0, rxjs_1.firstValueFrom)(this.httpService.get('https://api.betsapi.com/v1/sport/list', { params: { token: apiKey } }));
                if (check.data && check.data.success === 1) {
                    tokenStatus = "Token VALID (Basic endpoints OK)";
                }
                else {
                    tokenStatus = `Token REJECTED (API says: ${check.data?.error || 'Invalid Token'})`;
                }
            }
            catch (e) {
                tokenStatus = `Token INVALID/Exp or Connection Error (${e.message})`;
            }
            const mainSports = sportId ? [sportId] : [1, 3, 13, 18, 12, 4, 16];
            for (const endpoint of endpoints) {
                let hasData = false;
                const resultsForEndpoint = await Promise.all(mainSports.map(async (sId) => {
                    try {
                        const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get(endpoint, { params: { token: apiKey, sport_id: sId } }));
                        if (resp.data && resp.data.success === 0) {
                            debugSet.add(`${endpoint.split('/')[4]} -> ${resp.data.error || '403 Forbidden'}`);
                        }
                        if (resp.data && resp.data.success === 1 && resp.data.results && resp.data.results.length > 0) {
                            hasData = true;
                            return resp.data.results;
                        }
                    }
                    catch (e) {
                        debugSet.add(`${endpoint.split('/')[4]} -> Fail: ${e.message}`);
                    }
                    return [];
                }));
                if (hasData) {
                    allResults = resultsForEndpoint.flat();
                    break;
                }
            }
            let isSimulated = false;
            if (allResults.length === 0) {
                this.logger.warn("Activating HYBRID SIMULATOR mode due to API restrictions.");
                allResults = this.getSimulatedLiveGames(sportId);
                isSimulated = true;
            }
            const enrichedResults = allResults.map(item => {
                let odds = item.odds || null;
                if (!odds) {
                    const markets = item.main?.sp || {};
                    const targetMarket = markets.full_time_result || markets.match_winner || markets.to_win_the_match || markets.h2h;
                    if (targetMarket && Array.isArray(targetMarket.odds)) {
                        odds = targetMarket.odds.map(o => ({ name: o.header || o.name, value: o.odds }));
                    }
                }
                return { ...item, odds: odds };
            });
            let finalDebug = Array.from(debugSet);
            if (tokenStatus.includes("VALID") && isSimulated && finalDebug.length > 0) {
                finalDebug.unshift("PLAN RESTRICTION: Showing Simulated Data for Demo Purposes.");
            }
            else {
                finalDebug.unshift(`Account Status: ${tokenStatus}`);
            }
            const finalResponse = {
                success: true,
                results: enrichedResults,
                timestamp: new Date().toISOString(),
                count: enrichedResults.length,
                is_simulated: isSimulated,
                debug: isSimulated ? finalDebug : undefined
            };
            if (enrichedResults.length > 0) {
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 10).catch(() => { });
            }
            return finalResponse;
        }
        catch (err) {
            return { success: false, results: [], error: err.message, debug: [tokenStatus, ...Array.from(debugSet)] };
        }
    }
    getSimulatedLiveGames(sportId) {
        const fallbacks = [
            { id: "s1", home: { name: "Manchester City" }, away: { name: "Real Madrid" }, sport_id: "1", odds: [{ name: "1", value: "2.10" }, { name: "X", value: "3.45" }, { name: "2", value: "3.20" }] },
            { id: "s2", home: { name: "India" }, away: { name: "Pakistan" }, sport_id: "3", odds: [{ name: "1", value: "1.85" }, { name: "2", value: "1.95" }] },
            { id: "s3", home: { name: "Lakers" }, away: { name: "Golden State" }, sport_id: "18", odds: [{ name: "1", value: "1.90" }, { name: "2", value: "1.90" }] },
            { id: "s4", home: { name: "Alcaraz" }, away: { name: "Sinner" }, sport_id: "13", odds: [{ name: "1", value: "1.65" }, { name: "2", value: "2.25" }] },
            { id: "s5", home: { name: "PSG" }, away: { name: "Bayern Munich" }, sport_id: "1", odds: [{ name: "1", value: "2.50" }, { name: "X", value: "3.10" }, { name: "2", value: "2.80" }] },
            { id: "s6", home: { name: "England" }, away: { name: "Australia" }, sport_id: "3", odds: [{ name: "1", value: "2.05" }, { name: "2", value: "1.80" }] },
        ];
        if (sportId)
            return fallbacks.filter(g => g.sport_id === sportId.toString());
        return fallbacks;
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