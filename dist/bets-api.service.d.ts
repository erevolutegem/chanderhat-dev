import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
export declare class BetsApiService {
    private readonly httpService;
    private readonly configService;
    private readonly logger;
    private readonly cache;
    constructor(httpService: HttpService, configService: ConfigService);
    private parseBet365Stream;
    getLiveGames(sportId?: number): Promise<any>;
    getGameDetails(eventId: string): Promise<any>;
}
