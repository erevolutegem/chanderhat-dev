import { BetsApiService } from './bets-api.service';
export declare class GamesController {
    private readonly betsApiService;
    constructor(betsApiService: BetsApiService);
    getLiveGames(sportId?: string): Promise<any>;
    getGameDetails(id: string): Promise<any>;
}
