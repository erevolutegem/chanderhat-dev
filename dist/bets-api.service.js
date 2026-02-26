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
            'https://api.betsapi.com/v1/bet365/inplay',
            'https://api.b365api.com/v1/bet365/inplay',
        ];
        this.logger.log(`Fetching matches v9.0 (Hierarchical). Token: ${apiKey?.substring(0, 5)}...`);
        const cacheKey = sportId ? `betsapi:live_games:${sportId}` : `betsapi:live_games:all`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                this.logger.log(`Serving from cache: ${cacheKey}`);
                return JSON.parse(cached);
            }
        }
        catch (err) { }
        let allParsedResults = [];
        let debugInfo = [];
        try {
            const sportsToFetch = sportId ? [sportId] : [1, 13, 18, 12, 4, 16];
            for (const endpoint of endpoints) {
                const resultsForEndpoint = await Promise.all(sportsToFetch.map(async (sId) => {
                    try {
                        const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get(endpoint, { params: { token: apiKey, sport_id: sId } }));
                        if (resp.data && resp.data.success === 1 && resp.data.results) {
                            const parsed = this.parseBet365Inplay(resp.data.results);
                            if (parsed.length > 0) {
                                this.logger.log(`SUCCESS: Found ${parsed.length} real matches for sport ${sId} via ${endpoint}`);
                                return parsed;
                            }
                        }
                    }
                    catch (e) {
                        debugInfo.push(`Error ${endpoint} (sport ${sId}): ${e.message}`);
                    }
                    return [];
                }));
                allParsedResults = resultsForEndpoint.flat();
                if (allParsedResults.length > 0)
                    break;
            }
            const finalResponse = {
                success: true,
                results: allParsedResults,
                timestamp: new Date().toISOString(),
                count: allParsedResults.length,
                is_simulated: false,
                debug: debugInfo.length > 0 ? debugInfo : undefined
            };
            if (allParsedResults.length > 0) {
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 15).catch(() => { });
            }
            return finalResponse;
        }
        catch (err) {
            this.logger.error(`Critical error in getLiveGames: ${err.message}`);
            return { success: false, results: [], error: err.message };
        }
    }
    parseBet365Inplay(results) {
        if (!results || !Array.isArray(results))
            return [];
        const items = Array.isArray(results[0]) ? results[0] : results;
        const events = [];
        let currentCT = null;
        let currentEV = null;
        let currentMA = null;
        for (const item of items) {
            if (item.type === 'CT') {
                currentCT = item;
            }
            else if (item.type === 'EV') {
                const leagueName = (currentCT?.NA || '').toLowerCase();
                const eventName = (item.NA || '').toLowerCase();
                const isVirtual = item.VI === '1' ||
                    leagueName.includes('esoccer') ||
                    leagueName.includes('ebasketball') ||
                    leagueName.includes('volta') ||
                    eventName.includes('esoccer') ||
                    eventName.includes('ebasketball') ||
                    (item.HP === '1' && (item.TU || '').includes('VIRTUAL'));
                if (isVirtual) {
                    currentEV = null;
                    continue;
                }
                currentEV = {
                    id: item.ID,
                    sport_id: item.CL || null,
                    league: currentCT ? currentCT.NA : 'Unknown League',
                    home: item.NA?.split(' v ')[0] || 'Team A',
                    away: item.NA?.split(' v ')[1] || 'Team B',
                    name: item.NA,
                    ss: item.SS || '0-0',
                    timer: item.TM || '0',
                    time_status: item.TT || '0',
                    is_virtual: false,
                    odds: []
                };
                events.push(currentEV);
            }
            else if (item.type === 'MA' && currentEV) {
                currentMA = item;
            }
            else if (item.type === 'PA' && currentEV && currentMA) {
                if (currentMA.ID === '1777' || currentMA.NA?.toLowerCase().includes('result') || currentMA.NA?.toLowerCase().includes('winner')) {
                    const label = item.OR === '0' ? '1' : (item.OR === '1' ? 'X' : '2');
                    currentEV.odds.push({ name: label, value: item.OD });
                }
            }
        }
        return events;
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