import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { firstValueFrom } from 'rxjs';

// BetsAPI sport IDs
const SPORTS = [
    { id: 1, name: 'Soccer' },
    { id: 3, name: 'Cricket' },
    { id: 13, name: 'Tennis' },
    { id: 18, name: 'Basketball' },
    { id: 12, name: 'American Football' },
    { id: 4, name: 'Ice Hockey' },
];

const INPLAY_ENDPOINTS = [
    'https://api.betsapi.com/v1/bet365/inplay',
    'https://api.b365api.com/v1/bet365/inplay',
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
     * Fetch live in-play games.
     * If sportId is given, fetch only that sport (with sport_id param, so API filters it).
     * If no sportId, fetch all sports in parallel and merge.
     */
    async getLiveGames(sportId?: number): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();
        const cacheKey = `betsapi:live:${sportId ?? 'all'}`;

        // Serve from cache if available
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                this.logger.log(`Cache HIT: ${cacheKey}`);
                return JSON.parse(cached);
            }
        } catch (_) { /* ignore */ }

        this.logger.log(`Fetching live games. sportId=${sportId ?? 'ALL'}. Token: ${apiKey?.slice(0, 8)}...`);

        const sportsToFetch = sportId
            ? [{ id: sportId, name: SPORTS.find(s => s.id === sportId)?.name ?? 'Sport' }]
            : SPORTS;

        // Fetch each sport separately so they're properly tagged
        const allEvents: any[] = [];

        await Promise.all(sportsToFetch.map(async (sport) => {
            for (const endpoint of INPLAY_ENDPOINTS) {
                try {
                    const resp = await firstValueFrom(
                        this.httpService.get(endpoint, {
                            params: { token: apiKey, sport_id: sport.id },
                            timeout: 10000,
                        })
                    );

                    if (resp.data?.success === 1 && resp.data?.results) {
                        // Parse and tag with the sport_id we requested
                        const events = this.parseBet365Inplay(resp.data.results, sport.id);
                        if (events.length > 0) {
                            this.logger.log(`${sport.name}: ${events.length} live events`);
                            allEvents.push(...events);
                            break; // Stop trying endpoints once we get data
                        }
                    }
                } catch (e: any) {
                    this.logger.warn(`Error fetching ${sport.name} from ${endpoint}: ${e.message}`);
                }
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
                const response = { success: true, results: resp.data.results, timestamp: new Date().toISOString() };
                await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 10).catch(() => { });
                return response;
            }
            return { success: false, error: 'Event not found' };
        } catch (err: any) {
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
        } catch (_) { /* ignore */ }

        const sportsToFetch = sportId
            ? [{ id: sportId, name: SPORTS.find(s => s.id === sportId)?.name ?? 'Sport' }]
            : SPORTS;

        const allEvents: any[] = [];

        await Promise.all(sportsToFetch.map(async (sport) => {
            try {
                const resp = await firstValueFrom(
                    this.httpService.get('https://api.betsapi.com/v1/events/upcoming', {
                        params: { token: apiKey, sport_id: sport.id, page: 1, per_page: 30 },
                        timeout: 8000,
                    })
                );

                if (resp.data?.success === 1 && resp.data?.results) {
                    const events = resp.data.results.map((ev: any) => ({
                        id: String(ev.id || ev.FI),
                        sport_id: String(sport.id),
                        league: ev.league?.name || 'Unknown League',
                        home: ev.home?.name || 'Home Team',
                        away: ev.away?.name || 'Away Team',
                        name: `${ev.home?.name || 'Home'} vs ${ev.away?.name || 'Away'}`,
                        ss: null,
                        timer: null,
                        time_status: '0',
                        scheduled_time: ev.time,
                        odds: [],
                    }));
                    this.logger.log(`${sport.name} upcoming: ${events.length} events`);
                    allEvents.push(...events);
                }
            } catch (e: any) {
                this.logger.warn(`Upcoming fetch error for ${sport.name}: ${e.message}`);
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
     * Parse the hierarchical Bet365 inplay stream.
     * `forceSportId` is the sport_id we requested — we tag all events with it.
     */
    private parseBet365Inplay(results: any[], forceSportId: number): any[] {
        if (!results || !Array.isArray(results)) return [];

        const items: any[] = Array.isArray(results[0]) ? results[0] : results;
        const events: any[] = [];
        let currentCT: any = null;
        let currentEV: any = null;
        let currentMA: any = null;

        for (const item of items) {
            if (!item?.type) continue;

            if (item.type === 'CT') {
                currentCT = item;
                currentEV = null;
                currentMA = null;
            } else if (item.type === 'EV') {
                const leagueName = (currentCT?.NA || '').toLowerCase();
                const eventName = (item.NA || '').toLowerCase();

                // Filter out virtual / esports events
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

                const nameParts = (item.NA || '').split(/\s+v(?:s)?\s+/i);
                const home = (nameParts[0] || 'Home').trim();
                const away = (nameParts[1] || 'Away').trim();

                currentEV = {
                    id: item.ID || item.FI,
                    sport_id: String(forceSportId),   // ← Tag with the API sport_id we requested
                    league: currentCT?.NA || 'Unknown League',
                    home,
                    away,
                    name: item.NA || `${home} vs ${away}`,
                    ss: item.SS || null,
                    timer: item.TM || null,
                    time_status: item.TT || '1',
                    is_virtual: false,
                    odds: [],
                };
                events.push(currentEV);
                currentMA = null;
            } else if (item.type === 'MA' && currentEV) {
                currentMA = item;
            } else if (item.type === 'PA' && currentEV && currentMA) {
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

        return events;
    }
}
