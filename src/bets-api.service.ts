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

        // Comprehensive list of possible BetsAPI endpoints
        const endpoints = [
            'https://api.betsapi.com/v1/bet365/inplay',
            'https://api.b365api.com/v1/bet365/inplay',
            'https://api.betsapi.com/v1/events/inplay',
            'https://api.b365api.com/v1/events/inplay'
        ];

        this.logger.log(`Fetching live matches v7.1. SportID: ${sportId || 'ALL'}. Token: ${apiKey?.substring(0, 5)}...`);

        const cacheKey = sportId ? `betsapi:live_games:${sportId}` : `betsapi:live_games:all`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { }

        let allResults: any[] = [];
        let debugInfo: string[] = [];

        try {
            const mainSports = sportId ? [sportId] : [1, 3, 13, 18, 12, 4, 16];

            for (const endpoint of endpoints) {
                this.logger.log(`Testing endpoint: ${endpoint}`);
                let hasData = false;

                const resultsForEndpoint = await Promise.all(mainSports.map(async (sId) => {
                    try {
                        const resp = await firstValueFrom(
                            this.httpService.get(endpoint, {
                                params: { token: apiKey, sport_id: sId }
                            })
                        );

                        // Capture API-specific error messages for diagnostics
                        if (resp.data && resp.data.success === 0) {
                            debugInfo.push(`${endpoint} error: ${resp.data.error || 'Unknown'}`);
                        }

                        if (resp.data && resp.data.success === 1 && resp.data.results && resp.data.results.length > 0) {
                            hasData = true;
                            return resp.data.results;
                        }
                    } catch (e) {
                        debugInfo.push(`${endpoint} fetch failed: ${e.message}`);
                    }
                    return [];
                }));

                if (hasData) {
                    allResults = resultsForEndpoint.flat();
                    this.logger.log(`SUCCESS: Found ${allResults.length} matches via ${endpoint}`);
                    break;
                }
            }

            // Enrich each match with simple odds if available
            const enrichedResults = allResults.map(item => {
                let odds = null;
                const markets = item.main?.sp || item.odds || {};
                const targetMarket = markets.full_time_result || markets.match_winner || markets.to_win_the_match || markets.h2h;

                if (targetMarket && Array.isArray(targetMarket.odds)) {
                    odds = targetMarket.odds.map(o => ({
                        name: o.header || o.name,
                        value: o.odds
                    }));
                }

                return { ...item, odds: odds };
            });

            const finalResponse = {
                success: enrichedResults.length > 0,
                results: enrichedResults,
                timestamp: new Date().toISOString(),
                count: enrichedResults.length,
                debug: enrichedResults.length === 0 ? debugInfo.slice(0, 3) : undefined
            };

            if (enrichedResults.length > 0) {
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 10).catch(() => { });
            }

            return finalResponse;

        } catch (err) {
            this.logger.error(`Fatal in getLiveGames: ${err.message}`);
            return { success: false, results: [], error: err.message, debug: debugInfo };
        }
    }
}
