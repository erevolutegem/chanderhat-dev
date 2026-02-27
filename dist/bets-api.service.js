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
const rxjs_1 = require("rxjs");
const INCLUDED_SPORTS = new Set([1, 3, 13, 17, 18, 12]);
const SKIP_NAMES = ['esoccer', 'ebasketball', 'cs2', 'valorant', 'virtual', 'sports based games'];
const APP_SPORT_ID = {
    1: 1, 3: 3, 13: 13, 17: 4, 18: 18, 12: 12,
};
class MemCache {
    store = new Map();
    get(key) {
        const e = this.store.get(key);
        if (!e)
            return null;
        if (Date.now() > e.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return e.value;
    }
    set(key, value, ttlMs) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    prune() {
        const now = Date.now();
        for (const [k, v] of this.store) {
            if (now > v.expiresAt)
                this.store.delete(k);
        }
    }
}
let BetsApiService = BetsApiService_1 = class BetsApiService {
    httpService;
    configService;
    logger = new common_1.Logger(BetsApiService_1.name);
    cache = new MemCache();
    constructor(httpService, configService) {
        this.httpService = httpService;
        this.configService = configService;
        setInterval(() => this.cache.prune(), 60_000);
    }
    parseBet365Stream(items) {
        const events = [];
        let currentLeague = 'Unknown League';
        for (const item of items) {
            if (!item?.type)
                continue;
            if (item.type === 'CT') {
                currentLeague = item.NA || 'Unknown League';
            }
            else if (item.type === 'EV') {
                const id = item.ID || item.FI || '';
                const m = id.match(/C(\d+)A/);
                if (!m)
                    continue;
                const betsApiSport = parseInt(m[1], 10);
                if (!INCLUDED_SPORTS.has(betsApiSport))
                    continue;
                const leagueLower = currentLeague.toLowerCase();
                if (SKIP_NAMES.some(s => leagueLower.includes(s)))
                    continue;
                const appSportId = APP_SPORT_ID[betsApiSport] ?? betsApiSport;
                const nameParts = (item.NA || '').split(/\s+v(?:s)?\s+/i);
                const home = nameParts[0]?.trim() || item.NA || 'Home';
                const away = nameParts[1]?.trim() || 'Away';
                events.push({
                    id,
                    sport_id: String(appSportId),
                    league: currentLeague,
                    home,
                    away,
                    name: item.NA || `${home} vs ${away}`,
                    ss: item.SS || null,
                    timer: item.TM || null,
                    time_status: '1',
                    odds: [],
                });
            }
            else if (item.type === 'PA' && events.length > 0) {
                const last = events[events.length - 1];
                if (last.odds.length < 3 && item.OD) {
                    const label = item.OR === '0' ? '1' : item.OR === '1' ? 'X' : '2';
                    last.odds.push({ name: label, value: item.OD });
                }
            }
        }
        return events;
    }
    async getLiveGames(sportId) {
        const apiKey = this.configService.get('BETS_API_TOKEN');
        const cacheKey = `live:${sportId ?? 'all'}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }
        this.logger.log(`Fetching BetsAPI bet365/inplay (sportId=${sportId ?? 'ALL'})`);
        try {
            const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get('https://api.betsapi.com/v1/bet365/inplay', {
                params: { token: apiKey },
                timeout: 15000,
            }));
            if (resp.data?.success !== 1) {
                this.logger.warn('BetsAPI returned success=0');
                return { success: false, results: [], count: 0 };
            }
            const rawItems = Array.isArray(resp.data.results?.[0])
                ? resp.data.results[0]
                : resp.data.results || [];
            let events = this.parseBet365Stream(rawItems);
            if (sportId !== undefined) {
                events = events.filter(ev => ev.sport_id === String(sportId));
            }
            const response = {
                success: true,
                results: events,
                count: events.length,
                timestamp: new Date().toISOString(),
            };
            this.cache.set(cacheKey, response, 10_000);
            return response;
        }
        catch (e) {
            this.logger.error(`getLiveGames failed: ${e.message}`);
            return { success: false, results: [], count: 0, error: e.message };
        }
    }
    async getGameDetails(eventId) {
        const apiKey = this.configService.get('BETS_API_TOKEN');
        const cacheKey = `details:${eventId}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        try {
            const resp = await (0, rxjs_1.firstValueFrom)(this.httpService.get('https://api.betsapi.com/v1/bet365/event', {
                params: { token: apiKey, FI: eventId },
                timeout: 8000,
            }));
            if (resp.data?.success === 1 && resp.data?.results) {
                const response = {
                    success: true,
                    results: resp.data.results,
                    timestamp: new Date().toISOString(),
                };
                this.cache.set(cacheKey, response, 8_000);
                return response;
            }
            return { success: false, error: 'Event not found' };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    }
};
exports.BetsApiService = BetsApiService;
exports.BetsApiService = BetsApiService = BetsApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], BetsApiService);
//# sourceMappingURL=bets-api.service.js.map