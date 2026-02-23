import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { firstValueFrom, catchError } from 'rxjs';

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

        // Prioritize more universal endpoints first (events/inplay usually more open than bet365/inplay)
        const endpoints = [
            'https://api.betsapi.com/v1/events/inplay',
            'https://api.b365api.com/v1/events/inplay',
            'https://api.betsapi.com/v1/bet365/inplay',
            'https://api.b365api.com/v1/bet365/inplay'
        ];

        this.logger.log(`Fetching matches v7.3. SportID: ${sportId || 'ALL'}. Token: ${apiKey?.substring(0, 5)}...`);

        const cacheKey = sportId ? `betsapi:live_games:${sportId}` : `betsapi:live_games:all`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { }

        let allResults: any[] = [];
        let debugSet = new Set<string>();
        let tokenStatus = "Unknown";

        try {
            // DIAGNOSTIC: Check basic token validity with a non-inplay endpoint
            try {
                const check = await firstValueFrom(this.httpService.get('https://api.betsapi.com/v1/sport/list', { params: { token: apiKey } }));
                if (check.data && check.data.success === 1) {
                    tokenStatus = "Token VALID (Basic endpoints OK)";
                } else {
                    tokenStatus = `Token REJECTED (API says: ${check.data?.error || 'Invalid Token'})`;
                }
            } catch (e) {
                tokenStatus = `Token INVALID/Exp or Conn Error (${e.message})`;
            }

            const mainSports = sportId ? [sportId] : [1, 3, 13, 18, 12, 4, 16];

            for (const endpoint of endpoints) {
                this.logger.log(`Trying ${endpoint}...`);
                let hasData = false;

                const resultsForEndpoint = await Promise.all(mainSports.map(async (sId) => {
                    try {
                        const resp = await firstValueFrom(
                            this.httpService.get(endpoint, {
                                params: { token: apiKey, sport_id: sId }
                            })
                        );

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
                    this.logger.log(`Got ${allResults.length} matches from ${endpoint}`);
                    break;
                }
            }

            const enrichedResults = allResults.map(item => {
                let odds = null;
                const markets = item.main?.sp || item.odds || {};
                const targetMarket = markets.full_time_result || markets.match_winner || markets.to_win_the_match || markets.h2h;

                if (targetMarket && Array.isArray(targetMarket.odds)) {
                    odds = targetMarket.odds.map(o => ({ name: o.header || o.name, value: o.odds }));
                }

                return { ...item, odds: odds };
            });

            // Detection: If token is valid but ALL inplay endpoints failed, it's a Plan Restriction
            let finalDebug = Array.from(debugSet);
            if (tokenStatus.includes("VALID") && enrichedResults.length === 0 && finalDebug.length > 0) {
                finalDebug.unshift("PLAN RESTRICTION: Your BetsAPI plan does NOT include In-Play data access. Please check your subscription.");
            } else {
                finalDebug.unshift(`Account: ${tokenStatus}`);
            }

            const finalResponse = {
                success: enrichedResults.length > 0,
                results: enrichedResults,
                timestamp: new Date().toISOString(),
                count: enrichedResults.length,
                debug: enrichedResults.length === 0 ? finalDebug : undefined
            };

            if (enrichedResults.length > 0) {
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 10).catch(() => { });
            }

            return finalResponse;

        } catch (err) {
            this.logger.error(`Fatal: ${err.message}`);
            return { success: false, results: [], error: err.message, debug: [tokenStatus, ...Array.from(debugSet)] };
        }
    }
}
