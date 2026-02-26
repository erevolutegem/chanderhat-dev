import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BetsApiService {
    private readonly logger = new Logger(BetsApiService.name);

    // BetsAPI sport IDs mapping
    private readonly SPORT_IDS: Record<number, string> = {
        1: 'Soccer',
        3: 'Cricket',
        13: 'Tennis',
        18: 'Basketball',
        12: 'American Football',
        4: 'Ice Hockey',
        16: 'Baseball',
    };

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) { }

    async getLiveGames(sportId?: number): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();

        // Always fetch ALL games first (endpoint ignores sport_id anyway)
        // Then filter locally. Use a single "all" cache key for the raw data.
        const rawCacheKey = `betsapi:raw:all`;
        const filteredCacheKey = sportId ? `betsapi:filtered:${sportId}` : `betsapi:filtered:all`;

        // Try to serve filtered result from cache
        try {
            const cached = await redisClient.get(filteredCacheKey);
            if (cached) {
                this.logger.log(`Cache hit: ${filteredCacheKey}`);
                return JSON.parse(cached);
            }
        } catch (err) { /* ignore */ }

        this.logger.log(`Fetching live games v10.0. sportId filter: ${sportId ?? 'ALL'}. Token: ${apiKey?.substring(0, 8)}...`);

        // Try to use cached raw data to avoid repeated API calls
        let allEvents: any[] = [];
        let fromCache = false;

        try {
            const cachedRaw = await redisClient.get(rawCacheKey);
            if (cachedRaw) {
                allEvents = JSON.parse(cachedRaw);
                fromCache = true;
                this.logger.log(`Using cached raw events (${allEvents.length} total)`);
            }
        } catch (err) { /* ignore */ }

        if (!fromCache) {
            const endpoints = [
                'https://api.betsapi.com/v1/bet365/inplay',
                'https://api.b365api.com/v1/bet365/inplay',
            ];

            for (const endpoint of endpoints) {
                try {
                    const resp = await firstValueFrom(
                        this.httpService.get(endpoint, { params: { token: apiKey }, timeout: 10000 })
                    );

                    if (resp.data?.success === 1 && resp.data?.results) {
                        allEvents = this.parseBet365Inplay(resp.data.results);
                        this.logger.log(`SUCCESS: Parsed ${allEvents.length} real events from ${endpoint}`);

                        if (allEvents.length > 0) {
                            // Cache raw parsed events for 20s
                            await redisClient.set(rawCacheKey, JSON.stringify(allEvents), 'EX', 20).catch(() => { });
                            break;
                        }
                    } else {
                        this.logger.warn(`API returned no data from ${endpoint}: ${JSON.stringify(resp.data)?.substring(0, 200)}`);
                    }
                } catch (e: any) {
                    this.logger.error(`Error fetching from ${endpoint}: ${e.message}`);
                }
            }
        }

        // Now filter locally by sport_id if needed
        const filteredEvents = sportId
            ? allEvents.filter(ev => String(ev.sport_id) === String(sportId))
            : allEvents;

        this.logger.log(`Returning ${filteredEvents.length} events (filter: ${sportId ?? 'ALL'})`);

        const finalResponse = {
            success: true,
            results: filteredEvents,
            timestamp: new Date().toISOString(),
            count: filteredEvents.length,
            is_simulated: false,
        };

        // Cache filtered for 15s
        if (filteredEvents.length > 0) {
            await redisClient.set(filteredCacheKey, JSON.stringify(finalResponse), 'EX', 15).catch(() => { });
        }

        return finalResponse;
    }

    async getGameDetails(eventId: string): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:game_details:${eventId}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { /* ignore */ }

        try {
            const resp = await firstValueFrom(
                this.httpService.get('https://api.betsapi.com/v1/bet365/event', {
                    params: { token: apiKey, FI: eventId },
                    timeout: 8000,
                })
            );

            if (resp.data?.success === 1 && resp.data?.results) {
                const finalResponse = {
                    success: true,
                    results: resp.data.results,
                    timestamp: new Date().toISOString(),
                };
                await redisClient.set(cacheKey, JSON.stringify(finalResponse), 'EX', 10).catch(() => { });
                return finalResponse;
            }
            return { success: false, error: 'Event not found' };
        } catch (err: any) {
            this.logger.error(`getGameDetails error for ${eventId}: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    async getUpcomingGames(sportId?: number, dateFilter?: string): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:upcoming:${sportId ?? 'all'}:${dateFilter ?? 'today'}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { /* ignore */ }

        // Calculate date range based on filter
        const now = new Date();
        let startTime: number;
        let endTime: number;

        if (dateFilter === 'tomorrow') {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            const tomorrowEnd = new Date(tomorrow);
            tomorrowEnd.setHours(23, 59, 59, 0);
            startTime = Math.floor(tomorrow.getTime() / 1000);
            endTime = Math.floor(tomorrowEnd.getTime() / 1000);
        } else {
            // Today
            const todayEnd = new Date(now);
            todayEnd.setHours(23, 59, 59, 0);
            startTime = Math.floor(now.getTime() / 1000);
            endTime = Math.floor(todayEnd.getTime() / 1000);
        }

        try {
            const params: any = {
                token: apiKey,
                sport_id: sportId || 1,
                time_type: 1, // Scheduled only
                page: 1,
                per_page: 50,
            };

            const resp = await firstValueFrom(
                this.httpService.get('https://api.betsapi.com/v1/events/upcoming', {
                    params,
                    timeout: 8000,
                })
            );

            if (resp.data?.success === 1 && resp.data?.results) {
                const events = resp.data.results.map((ev: any) => ({
                    id: String(ev.id || ev.FI),
                    sport_id: String(sportId || 1),
                    league: ev.league?.name || 'Unknown League',
                    home: ev.home?.name || 'Home Team',
                    away: ev.away?.name || 'Away Team',
                    name: `${ev.home?.name || 'Home'} vs ${ev.away?.name || 'Away'}`,
                    ss: null,
                    timer: null,
                    time_status: '0', // Scheduled
                    scheduled_time: ev.time,
                    is_virtual: false,
                    odds: [],
                }));

                const response = {
                    success: true,
                    results: events,
                    count: events.length,
                    timestamp: new Date().toISOString(),
                };
                await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 60).catch(() => { });
                return response;
            }
            return { success: true, results: [], count: 0 };
        } catch (err: any) {
            this.logger.error(`getUpcomingGames error: ${err.message}`);
            return { success: false, results: [], error: err.message };
        }
    }

    private parseBet365Inplay(results: any[]): any[] {
        if (!results || !Array.isArray(results)) return [];

        // The API returns results[0] as the flat items array
        const items: any[] = Array.isArray(results[0]) ? results[0] : results;
        const events: any[] = [];
        let currentCT: any = null;
        let currentEV: any = null;
        let currentMA: any = null;

        for (const item of items) {
            if (!item || !item.type) continue;

            if (item.type === 'CT') {
                currentCT = item;
                currentEV = null;
            } else if (item.type === 'EV') {
                const leagueName = (currentCT?.NA || '').toLowerCase();
                const eventName = (item.NA || '').toLowerCase();

                // Filter out virtual/esports matches
                const isVirtual =
                    item.VI === '1' ||
                    leagueName.includes('esoccer') ||
                    leagueName.includes('ebasketball') ||
                    leagueName.includes('evirtual') ||
                    leagueName.includes('volta') ||
                    eventName.includes('esoccer') ||
                    eventName.includes('ebasketball');

                if (isVirtual) {
                    currentEV = null;
                    continue;
                }

                // Extract home / away from "Team A v Team B" or "Team A vs Team B"
                const nameParts = (item.NA || '').split(/\s+v(?:s)?\s+/i);
                const home = (nameParts[0] || 'Home').trim();
                const away = (nameParts[1] || 'Away').trim();

                currentEV = {
                    id: item.ID || item.FI,
                    sport_id: item.CL || currentCT?.CL || null,
                    league: currentCT?.NA || 'Unknown League',
                    home,
                    away,
                    name: item.NA || `${home} vs ${away}`,
                    ss: item.SS || '0-0',
                    timer: item.TM || '0',
                    time_status: item.TT || '1',
                    is_virtual: false,
                    odds: [],
                };
                events.push(currentEV);
            } else if (item.type === 'MA' && currentEV) {
                currentMA = item;
            } else if (item.type === 'PA' && currentEV && currentMA) {
                // Capture main match odds (Fulltime Result / Match Winner)
                if (
                    currentMA.ID === '1777' ||
                    currentMA.NA?.toLowerCase().includes('result') ||
                    currentMA.NA?.toLowerCase().includes('winner') ||
                    currentMA.NA?.toLowerCase().includes('moneyline') ||
                    currentMA.NA?.toLowerCase().includes('match')
                ) {
                    const label = item.OR === '0' ? '1' : (item.OR === '1' ? 'X' : '2');
                    currentEV.odds.push({ name: label, value: item.OD });
                }
            }
        }

        this.logger.log(`Parser: found ${events.length} non-virtual events from ${items.length} raw items`);
        return events;
    }
}
