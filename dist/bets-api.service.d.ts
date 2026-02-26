import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
export declare class BetsApiService {
    private readonly httpService;
    private readonly configService;
    private readonly redisService;
    private readonly logger;
    constructor(httpService: HttpService, configService: ConfigService, redisService: RedisService);
    getLiveGames(sportId?: number): Promise<any>;
    private parseBet365Inplay;
}
