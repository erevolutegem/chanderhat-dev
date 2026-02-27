import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';
import { EventsGateway } from './events.gateway';
import { RedisService } from './redis.service';

const SPORTS = [
    { id: 1, name: 'Soccer' },
    { id: 3, name: 'Cricket' },
    { id: 13, name: 'Tennis' },
    { id: 18, name: 'Basketball' },
    { id: 17, name: 'Ice Hockey' },
    { id: 12, name: 'American Football' },
];

@Processor('live-scores')
@Injectable()
export class LiveScoresProcessor extends WorkerHost implements OnModuleInit {
    private readonly logger = new Logger(LiveScoresProcessor.name);

    constructor(
        @InjectQueue('live-scores') private readonly queue: Queue,
        private readonly betsApiService: BetsApiService,
        private readonly eventsGateway: EventsGateway,
        private readonly redisService: RedisService,
    ) {
        super();
    }

    async onModuleInit() {
        // Schedule the initial poll job on startup
        await this.schedulePoll();
        this.logger.log('LiveScoresProcessor ready — initial poll scheduled ✅');
    }

    private async schedulePoll() {
        // Remove any existing repeatable jobs first
        const repeatables = await this.queue.getRepeatableJobs();
        for (const job of repeatables) {
            await this.queue.removeRepeatableByKey(job.key);
        }

        // Schedule repeating every 30 seconds
        await this.queue.add('poll', {}, {
            repeat: { every: 30_000 },
            removeOnComplete: 10,
            removeOnFail: 5,
        });
    }

    async process(job: Job): Promise<void> {
        if (job.name !== 'poll') return;

        this.logger.debug('Polling BetsAPI for live scores...');

        try {
            // Fetch all sports live games
            const result = await this.betsApiService.getLiveGames(undefined);
            const matches = result?.results ?? [];

            if (matches.length === 0) {
                this.logger.debug('No live matches currently.');
                return;
            }

            // Cache the full result
            await this.redisService.set('betsapi:live:all', JSON.stringify(result), 'EX', 35);

            // Group matches by sport and cache/push each sport separately
            const bySport: Record<string, any[]> = {};
            for (const match of matches) {
                const sid = match.sport_id ?? 'unknown';
                if (!bySport[sid]) bySport[sid] = [];
                bySport[sid].push(match);
            }

            for (const [sportId, sportMatches] of Object.entries(bySport)) {
                const sid = parseInt(sportId, 10);
                const sportResult = { success: true, results: sportMatches, count: sportMatches.length };
                await this.redisService.set(`betsapi:live:${sid}`, JSON.stringify(sportResult), 'EX', 35);

                // Push to Socket.io subscribers
                this.eventsGateway.pushLiveUpdate(isNaN(sid) ? null : sid, sportMatches);
            }

            // Push combined update
            this.eventsGateway.pushLiveUpdate(null, matches);
            this.logger.debug(`Poll complete: ${matches.length} matches pushed.`);
        } catch (err: any) {
            this.logger.error(`Poll failed: ${err.message}`);
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.verbose(`Job ${job.id} completed`);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, err: Error) {
        this.logger.error(`Job ${job.id} failed: ${err.message}`);
    }
}
