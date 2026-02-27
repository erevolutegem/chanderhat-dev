import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';
import { EventsGateway } from './events.gateway';

const POLL_MS = 5_000; // poll every 5 seconds

/**
 * LiveScoresService — replaces BullMQ entirely.
 * Just a setInterval that polls BetsAPI and pushes via Socket.io.
 * No Redis, no queue worker, no disk I/O.
 */
@Injectable()
export class LiveScoresService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(LiveScoresService.name);
    private timer: ReturnType<typeof setInterval> | null = null;
    private isPolling = false;

    constructor(
        private readonly betsApiService: BetsApiService,
        private readonly eventsGateway: EventsGateway,
    ) { }

    onModuleInit() {
        this.logger.log(`LiveScoresService starting — polling every ${POLL_MS / 1000}s ✅`);
        this.timer = setInterval(() => this.poll(), POLL_MS);
        // Run immediately on start
        this.poll();
    }

    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private async poll(): Promise<void> {
        if (this.isPolling) return; // skip if previous poll not done
        this.isPolling = true;

        try {
            const result = await this.betsApiService.getLiveGames(undefined);
            const matches: any[] = result?.results ?? [];

            if (matches.length === 0) return;

            // Group by sport and push per-sport update
            const bySport: Record<string, any[]> = {};
            for (const match of matches) {
                const sid = match.sport_id ?? 'unknown';
                (bySport[sid] ??= []).push(match);
            }

            for (const [sportId, sportMatches] of Object.entries(bySport)) {
                const sid = parseInt(sportId, 10);
                this.eventsGateway.pushLiveUpdate(isNaN(sid) ? null : sid, sportMatches);
            }

            // Push combined all-sports update
            this.eventsGateway.pushLiveUpdate(null, matches);
            this.logger.debug(`Poll complete: ${matches.length} live matches.`);
        } catch (err: any) {
            this.logger.error(`Poll failed: ${err.message}`);
        } finally {
            this.isPolling = false;
        }
    }
}
