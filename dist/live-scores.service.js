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
var LiveScoresService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveScoresService = void 0;
const common_1 = require("@nestjs/common");
const bets_api_service_1 = require("./bets-api.service");
const events_gateway_1 = require("./events.gateway");
const POLL_MS = 3_000;
let LiveScoresService = LiveScoresService_1 = class LiveScoresService {
    betsApiService;
    eventsGateway;
    logger = new common_1.Logger(LiveScoresService_1.name);
    timer = null;
    isPolling = false;
    constructor(betsApiService, eventsGateway) {
        this.betsApiService = betsApiService;
        this.eventsGateway = eventsGateway;
    }
    onModuleInit() {
        this.logger.log(`LiveScoresService starting — polling every ${POLL_MS / 1000}s ✅`);
        this.timer = setInterval(() => this.poll(), POLL_MS);
        this.poll();
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    async poll() {
        if (this.isPolling)
            return;
        this.isPolling = true;
        try {
            const result = await this.betsApiService.getLiveGames(undefined);
            const matches = result?.results ?? [];
            if (matches.length === 0)
                return;
            const bySport = {};
            for (const match of matches) {
                const sid = match.sport_id ?? 'unknown';
                (bySport[sid] ??= []).push(match);
            }
            for (const [sportId, sportMatches] of Object.entries(bySport)) {
                const sid = parseInt(sportId, 10);
                this.eventsGateway.pushLiveUpdate(isNaN(sid) ? null : sid, sportMatches);
            }
            this.eventsGateway.pushLiveUpdate(null, matches);
            this.logger.debug(`Poll complete: ${matches.length} live matches.`);
        }
        catch (err) {
            this.logger.error(`Poll failed: ${err.message}`);
        }
        finally {
            this.isPolling = false;
        }
    }
};
exports.LiveScoresService = LiveScoresService;
exports.LiveScoresService = LiveScoresService = LiveScoresService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bets_api_service_1.BetsApiService,
        events_gateway_1.EventsGateway])
], LiveScoresService);
//# sourceMappingURL=live-scores.service.js.map