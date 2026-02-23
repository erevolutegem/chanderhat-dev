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

        // Try these endpoints in order of preference
        const endpoints = [
            'https://api.betsapi.com/v1/bet365/inplay',
            'https://api.betsapi.com/v1/events/inplay'
        ];

        this.logger.log(`Fetching live matches. SportID: ${sportId || 'ALL'}. Token: ${apiKey?.substring(0, 5)}...`);

        const cacheKey = sportId ? `betsapi:live_games:${sportId}` : `betsapi:live_games:all`;
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { }

        let allResults: any[] = [];

        try {
            const mainSports = sportId ? [sportId] : [1, 3, 13, 18, 12, 4, 16]; // Soccer, Cricket, Tennis, Basketball, Volleyball, Futsal, Hockey

            for (const endpoint of endpoints) {
                this.logger.log(`Attempting endpoint: ${endpoint} for ${mainSports.length} sports`);
                const resultsForEndpoint = await Promise.all(mainSports.map(async (sId) => {
                    try {
                        const resp = await firstValueFrom(
                            this.httpService.get(endpoint, {
                                params: { token: apiKey, sport_id: sId }
                            })
                        );
                        if (resp.data && resp.data.success === 1 && resp.data.results && resp.data.results.length > 0) {
                            this.logger.log(`[BetsAPI] Sport ${sId} returned ${resp.data.results.length} matches via ${endpoint}`);
                            return resp.data.results;
                        }
                        if (resp.data && resp.data.error) {
                            this.logger.warn(`Endpoint ${endpoint} for sport ${sId} returned error: ${resp.data.error}`);
                        }
                    } catch (e) {
                        this.logger.warn(`Failed to fetch from ${endpoint} for sport ${sId}: ${e.message}`);
                    }
                    return [];
                }));

                allResults = resultsForEndpoint.flat();
                if (allResults.length > 0) {
                    this.logger.log(`Successfully fetched ${allResults.length} matches from ${endpoint}`);
                    break; // Use the first endpoint that returns data
                }
            }

            // Enrich each match with simple odds if available
            const enrichedResults = allResults.map(item => {
                let odds = null;
                // Try to find odds in common locations
                const markets = item.main?.sp || item.odds || {};
                const targetMarket = markets.full_time_result || markets.match_winner || markets.to_win_the_match || markets.h2h;

                if (targetMarket && Array.isArray(targetMarket.odds)) {
                    odds = targetMarket.odds.map(o => ({
                        name: o.header || o.name,
                        value: o.odds
                    }));
                } else if (item.odds && item.odds.h2h) {
                    // Alternative structure
                    odds = item.odds.h2h.map(o => ({ name: o.name, value: o.odds }));
                }

                return {
                    ...item,
                    odds: odds
                };
            });

            const finalResponse = {
                success: true,
                results: enrichedResults,
                timestamp: new Date().toISOString(),
                count: enrichedResults.length
            };

            if (enrichedResults.length > 0) {
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 10).catch(() => { });
            }

            return finalResponse;

        } catch (err) {
            this.logger.error(`Fatal in getLiveGames: ${err.message}`);
            return { success: false, results: [], error: err.message };
        }
    }
}
