import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { firstValueFrom } from 'rxjs';

// BetsAPI official sport IDs
const SPORTS: { id: number; name: string }[] = [
    { id: 1, name: 'Soccer' },
    { id: 3, name: 'Cricket' },
    { id: 13, name: 'Tennis' },
    { id: 18, name: 'Basketball' },
    { id: 12, name: 'American Football' },
    { id: 4, name: 'Ice Hockey' },
];

@Injectable()
export class BetsApiService {
    private readonly logger = new Logger(BetsApiService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
    ) { }

    /**
     * Fetch live in-play events using /v1/events/inplay
     * This endpoint properly supports sport_id filtering.
     */
    async getLiveGames(sportId?: number): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:inplay:v2:${sportId ?? 'all'}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                this.logger.log(`Cache HIT: ${cacheKey}`);
                return JSON.parse(cached);
            }
        } catch (_) { /* ignore */ }

        this.logger.log(`Fetching inplay. sportId=${sportId ?? 'ALL'}. Token: ${apiKey?.slice(0, 8)}...`);

        const sportsToFetch = sportId
            ? [{ id: sportId, name: SPORTS.find(s => s.id === sportId)?.name ?? 'Sport' }]
            : SPORTS;

        const allEvents: any[] = [];

        await Promise.all(sportsToFetch.map(async (sport) => {
            try {
                // Use the standard inplay endpoint — properly filters by sport_id
                const resp = await firstValueFrom(
                    this.httpService.get('https://api.betsapi.com/v1/events/inplay', {
                        params: {
                            token: apiKey,
                            sport_id: sport.id,
                        },
                        timeout: 10000,
                    })
                );

                if (resp.data?.success === 1 && Array.isArray(resp.data?.results)) {
                    const events = resp.data.results.map((ev: any) => ({
                        id: String(ev.id),
                        sport_id: String(sport.id),
                        league: ev.league?.name || 'Unknown League',
                        home: ev.home?.name || 'Home',
                        away: ev.away?.name || 'Away',
                        name: `${ev.home?.name} vs ${ev.away?.name}`,
                        ss: ev.ss || null,
                        timer: ev.timer?.tm || null,
                        time_status: String(ev.time_status || '1'),
                        is_virtual: false,
                        odds: [],
                    })).filter((ev: any) =>
                        // Skip virtual matches
                        !ev.league?.toLowerCase().includes('esoccer') &&
                        !ev.league?.toLowerCase().includes('ebasketball') &&
                        !ev.home?.toLowerCase().includes('virtual')
                    );

                    this.logger.log(`${sport.name} (id=${sport.id}): ${events.length} live events`);
                    allEvents.push(...events);
                } else {
                    this.logger.warn(`${sport.name}: no results. success=${resp.data?.success}`);
                }
            } catch (e: any) {
                this.logger.warn(`Error fetching inplay for ${sport.name}: ${e.message}`);
            }
        }));

        this.logger.log(`Total live events: ${allEvents.length}`);

        const response = {
            success: true,
            results: allEvents,
            count: allEvents.length,
            timestamp: new Date().toISOString(),
            is_simulated: false,
        };

        if (allEvents.length > 0) {
            await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 20).catch(() => { });
        }

        return response;
    }

    /**
     * Fetch upcoming (scheduled) events using /v1/events/upcoming
     */
    async getUpcomingGames(sportId?: number, dateFilter?: string): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:upcoming:v2:${sportId ?? 'all'}:${dateFilter ?? 'today'}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (_) { /* ignore */ }

        const sportsToFetch = sportId
            ? [{ id: sportId, name: SPORTS.find(s => s.id === sportId)?.name ?? 'Sport' }]
            : SPORTS;

        const allEvents: any[] = [];

        // Calculate day_offset: 0 = today, 1 = tomorrow
        const dayOffset = dateFilter === 'tomorrow' ? 1 : 0;

        await Promise.all(sportsToFetch.map(async (sport) => {
            try {
                const resp = await firstValueFrom(
                    this.httpService.get('https://api.betsapi.com/v1/events/upcoming', {
                        params: {
                            token: apiKey,
                            sport_id: sport.id,
                            day: dayOffset,
                            page: 1,
                            per_page: 50,
                        },
                        timeout: 10000,
                    })
                );

                if (resp.data?.success === 1 && Array.isArray(resp.data?.results)) {
                    const events = resp.data.results.map((ev: any) => ({
                        id: String(ev.id),
                        sport_id: String(sport.id),
                        league: ev.league?.name || 'Unknown League',
                        home: ev.home?.name || 'Home',
                        away: ev.away?.name || 'Away',
                        name: `${ev.home?.name} vs ${ev.away?.name}`,
                        ss: null,
                        timer: null,
                        time_status: '0',
                        scheduled_time: ev.time,
                        is_virtual: false,
                        odds: [],
                    }));

                    this.logger.log(`${sport.name} upcoming: ${events.length} events`);
                    allEvents.push(...events);
                }
            } catch (e: any) {
                this.logger.warn(`Upcoming error for ${sport.name}: ${e.message}`);
            }
        }));

        const response = {
            success: true,
            results: allEvents,
            count: allEvents.length,
            timestamp: new Date().toISOString(),
        };

        if (allEvents.length > 0) {
            await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 60).catch(() => { });
        }

        return response;
    }

    /**
     * Fetch detailed event info including odds via Bet365 event endpoint
     */
    async getGameDetails(eventId: string): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:details:${eventId}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (_) { /* ignore */ }

        try {
            const resp = await firstValueFrom(
                this.httpService.get('https://api.betsapi.com/v1/bet365/event', {
                    params: { token: apiKey, FI: eventId },
                    timeout: 8000,
                })
            );

            if (resp.data?.success === 1 && resp.data?.results) {
                const response = {
                    success: true,
                    results: resp.data.results,
                    timestamp: new Date().toISOString(),
                };
                await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 10).catch(() => { });
                return response;
            }
            return { success: false, error: 'Event not found' };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }
}
