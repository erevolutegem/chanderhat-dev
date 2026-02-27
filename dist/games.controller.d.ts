import { BetsApiService } from './bets-api.service';
export declare class GamesController {
    private readonly betsApiService;
    constructor(betsApiService: BetsApiService);
    getHealth(): {
        status: string;
        build: string;
        timestamp: string;
    };
    getLiveGames(sportId?: string, tab?: string): Promise<any>;
    getGameDetails(id: string): Promise<any>;
    getUpcomingGames(sportId?: string): Promise<any>;
}
