import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BetsApiService {
    private readonly logger = new Logger(BetsApiService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) { }

    async getLiveGames(sportId?: number): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
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
            if (cached) return JSON.parse(cached);
        } catch (err) { }

        let allResults: any[] = [];
        let debugSet = new Set<string>();
        let tokenStatus = "Unknown";

        try {
            // DIAGNOSTIC Check
            try {
                const check = await firstValueFrom(this.httpService.get('https://api.betsapi.com/v1/sport/list', { params: { token: apiKey } }));
                if (check.data && check.data.success === 1) {
                    tokenStatus = "Token VALID (Basic endpoints OK)";
                } else {
                    tokenStatus = `Token REJECTED (API says: ${check.data?.error || 'Invalid Token'})`;
                }
            } catch (e) {
                tokenStatus = `Token INVALID/Exp or Connection Error (${e.message})`;
            }

            const mainSports = sportId ? [sportId] : [1, 3, 13, 18, 12, 4, 16];

            for (const endpoint of endpoints) {
                let hasData = false;
                const resultsForEndpoint = await Promise.all(mainSports.map(async (sId) => {
                    try {
                        const resp = await firstValueFrom(this.httpService.get(endpoint, { params: { token: apiKey, sport_id: sId } }));
                        if (resp.data && resp.data.success === 0) {
                            debugSet.add(`${endpoint.split('/')[4]} -> ${resp.data.error || '403 Forbidden'}`);
                        }
                        if (resp.data && resp.data.success === 1 && resp.data.results && resp.data.results.length > 0) {
                            hasData = true;
                            return resp.data.results;
                        }
                    } catch (e) {
                        debugSet.add(`${endpoint.split('/')[4]} -> Fail: ${e.message}`);
                    }
                    return [];
                }));

                if (hasData) {
                    allResults = resultsForEndpoint.flat();
                    break;
                }
            }

            // SIMULATOR FALLBACK
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
            } else {
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

        } catch (err) {
            return { success: false, results: [], error: err.message, debug: [tokenStatus, ...Array.from(debugSet)] };
        }
    }

    private getSimulatedLiveGames(sportId?: number): any[] {
        const fallbacks = [
            { id: "s1", home: { name: "Manchester City" }, away: { name: "Real Madrid" }, sport_id: "1", odds: [{ name: "1", value: "2.10" }, { name: "X", value: "3.45" }, { name: "2", value: "3.20" }] },
            { id: "s2", home: { name: "India" }, away: { name: "Pakistan" }, sport_id: "3", odds: [{ name: "1", value: "1.85" }, { name: "2", value: "1.95" }] },
            { id: "s3", home: { name: "Lakers" }, away: { name: "Golden State" }, sport_id: "18", odds: [{ name: "1", value: "1.90" }, { name: "2", value: "1.90" }] },
            { id: "s4", home: { name: "Alcaraz" }, away: { name: "Sinner" }, sport_id: "13", odds: [{ name: "1", value: "1.65" }, { name: "2", value: "2.25" }] },
            { id: "s5", home: { name: "PSG" }, away: { name: "Bayern Munich" }, sport_id: "1", odds: [{ name: "1", value: "2.50" }, { name: "X", value: "3.10" }, { name: "2", value: "2.80" }] },
            { id: "s6", home: { name: "England" }, away: { name: "Australia" }, sport_id: "3", odds: [{ name: "1", value: "2.05" }, { name: "2", value: "1.80" }] },
        ];
        if (sportId) return fallbacks.filter(g => g.sport_id === sportId.toString());
        return fallbacks;
    }
}
