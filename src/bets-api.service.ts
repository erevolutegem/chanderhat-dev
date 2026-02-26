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
        } catch (err) { }

        let allParsedResults: any[] = [];
        let debugInfo: string[] = [];

        try {
            const sportsToFetch = sportId ? [sportId] : [1, 13, 18, 12, 4, 16]; // Soccer, Tennis, Basketball, etc.

            for (const endpoint of endpoints) {
                const resultsForEndpoint = await Promise.all(sportsToFetch.map(async (sId) => {
                    try {
                        const resp = await firstValueFrom(this.httpService.get(endpoint, { params: { token: apiKey, sport_id: sId } }));
                        if (resp.data && resp.data.success === 1 && resp.data.results) {
                            const parsed = this.parseBet365Inplay(resp.data.results);
                            if (parsed.length > 0) {
                                this.logger.log(`SUCCESS: Found ${parsed.length} real matches for sport ${sId} via ${endpoint}`);
                                return parsed;
                            }
                        }
                    } catch (e) {
                        debugInfo.push(`Error ${endpoint} (sport ${sId}): ${e.message}`);
                    }
                    return [];
                }));

                allParsedResults = resultsForEndpoint.flat();
                if (allParsedResults.length > 0) break;
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

        } catch (err) {
            this.logger.error(`Critical error in getLiveGames: ${err.message}`);
            return { success: false, results: [], error: err.message };
        }
    }

    async getGameDetails(eventId: string): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:game_details:${eventId}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { }

        try {
            // Using B365 Event view tool to get all markers and stats
            const url = `https://api.betsapi.com/v1/bet365/event`;
            const resp = await firstValueFrom(this.httpService.get(url, { params: { token: apiKey, FI: eventId } }));

            if (resp.data && resp.data.success === 1 && resp.data.results) {
                const finalResponse = {
                    success: true,
                    results: resp.data.results,
                    timestamp: new Date().toISOString()
                };
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 10).catch(() => { });
                return finalResponse;
            }
            return { success: false, error: 'Event not found or API error' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    private parseBet365Inplay(results: any[]): any[] {
        if (!results || !Array.isArray(results)) return [];

        const items = Array.isArray(results[0]) ? results[0] : results;
        const events: any[] = [];
        let currentCT: any = null;
        let currentEV: any = null;
        let currentMA: any = null;

        for (const item of items) {
            if (item.type === 'CT') {
                currentCT = item;
            } else if (item.type === 'EV') {
                // ROBUST VIRTUAL FILTERING
                const leagueName = (currentCT?.NA || '').toLowerCase();
                const eventName = (item.NA || '').toLowerCase();

                const isVirtual =
                    item.VI === '1' ||
                    leagueName.includes('esoccer') ||
                    leagueName.includes('ebasketball') ||
                    leagueName.includes('volta') ||
                    eventName.includes('esoccer') ||
                    eventName.includes('ebasketball') ||
                    (item.HP === '1' && (item.TU || '').includes('VIRTUAL')); // Extra check for virtual flags

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
            } else if (item.type === 'MA' && currentEV) {
                currentMA = item;
            } else if (item.type === 'PA' && currentEV && currentMA) {
                // Map Fulltime Result (1777) or Match Winner (H2H)
                if (currentMA.ID === '1777' || currentMA.NA?.toLowerCase().includes('result') || currentMA.NA?.toLowerCase().includes('winner')) {
                    const label = item.OR === '0' ? '1' : (item.OR === '1' ? 'X' : '2');
                    currentEV.odds.push({ name: label, value: item.OD });
                }
            }
        }
        return events;
    }
}
