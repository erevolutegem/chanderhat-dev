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

    async getLiveGames(sportId: number = 1): Promise<any> {
        const cacheKey = `betsapi:live_games:${sportId}`;
        const apiKey = this.configService.get<string>('BETS_API_TOKEN');
        const redisClient = this.redisService.getClient();

        // 1. Try Cache
        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) {
            this.logger.warn(`Redis error: ${err.message}`);
        }

        // 2. Fetch from External API
        try {
            this.logger.log(`Fetching live games for sport ${sportId}...`);
            const response = await firstValueFrom(
                this.httpService.get(`https://api.b365api.com/v1/bet365/inplay`, {
                    params: { token: apiKey, sport_id: sportId }
                }).pipe(
                    catchError((error) => {
                        this.logger.error(`API Error: ${error.message}`);
                        throw error;
                    })
                )
            );

            const data = response.data;

            // 3. Cache Result (5 seconds expiry)
            await redisClient.set(cacheKey, JSON.stringify(data), 'EX', 5).catch(() => { });

            return data;
        } catch (err) {
            this.logger.error(`Failed to fetch from BetsAPI: ${err.message}`);
            return { success: false, results: [] };
        }
    }
}
