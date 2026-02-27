import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

// BetsAPI sport IDs from event ID pattern C{n}A
const INCLUDED_SPORTS = new Set([1, 3, 13, 17, 18, 12]);
const SKIP_NAMES = ['esoccer', 'ebasketball', 'cs2', 'valorant', 'virtual', 'sports based games'];
const APP_SPORT_ID: Record<number, number> = {
    1: 1, 3: 3, 13: 13, 17: 4, 18: 18, 12: 12,
};

/* ─── Simple in-memory cache (replaces Redis/ioredis) ──────────── */
interface CacheEntry { value: any; expiresAt: number; }

class MemCache {
    private store = new Map<string, CacheEntry>();

    get(key: string): any | null {
        const e = this.store.get(key);
        if (!e) return null;
        if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
        return e.value;
    }

    set(key: string, value: any, ttlMs: number) {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    /** Prune expired entries (call periodically) */
    prune() {
        const now = Date.now();
        for (const [k, v] of this.store) { if (now > v.expiresAt) this.store.delete(k); }
    }
}

@Injectable()
export class BetsApiService {
    private readonly logger = new Logger(BetsApiService.name);
    private readonly cache = new MemCache();

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        // Prune expired cache entries every 60 seconds
        setInterval(() => this.cache.prune(), 60_000);
    }

    private parseBet365Stream(items: any[]): any[] {
        const events: any[] = [];
        let currentLeague = 'Unknown League';

        for (const item of items) {
            if (!item?.type) continue;

            if (item.type === 'CT') {
                currentLeague = item.NA || 'Unknown League';
            } else if (item.type === 'EV') {
                const id = item.ID || item.FI || '';
                const m = id.match(/C(\d+)A/);
                if (!m) continue;

                const betsApiSport = parseInt(m[1], 10);
                if (!INCLUDED_SPORTS.has(betsApiSport)) continue;

                const leagueLower = currentLeague.toLowerCase();
                if (SKIP_NAMES.some(s => leagueLower.includes(s))) continue;

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
            } else if (item.type === 'PA' && events.length > 0) {
                const last = events[events.length - 1];
                if (last.odds.length < 3 && item.OD) {
                    const label = item.OR === '0' ? '1' : item.OR === '1' ? 'X' : '2';
                    last.odds.push({ name: label, value: item.OD });
                }
            }
        }
        return events;
    }

    async getLiveGames(sportId?: number): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const cacheKey = `live:${sportId ?? 'all'}`;

        // Try cache first (TTL 10 seconds — fast refresh)
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.logger.debug(`Cache HIT: ${cacheKey}`);
            return cached;
        }

        this.logger.log(`Fetching BetsAPI bet365/inplay (sportId=${sportId ?? 'ALL'})`);

        try {
            const resp = await firstValueFrom(
                this.httpService.get('https://api.betsapi.com/v1/bet365/inplay', {
                    params: { token: apiKey },
                    timeout: 15000,
                })
            );

            if (resp.data?.success !== 1) {
                this.logger.warn('BetsAPI returned success=0');
                return { success: false, results: [], count: 0 };
            }

            const rawItems: any[] = Array.isArray(resp.data.results?.[0])
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

            // Cache for 10 seconds
            this.cache.set(cacheKey, response, 10_000);
            return response;
        } catch (e: any) {
            this.logger.error(`getLiveGames failed: ${e.message}`);
            return { success: false, results: [], count: 0, error: e.message };
        }
    }

    async getGameDetails(eventId: string): Promise<any> {
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const cacheKey = `details:${eventId}`;

        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

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
                // Cache event details for 8 seconds
                this.cache.set(cacheKey, response, 8_000);
                return response;
            }
            return { success: false, error: 'Event not found' };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    }
}
