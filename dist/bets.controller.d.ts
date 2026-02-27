import { BetsService } from './bets.service';
export declare class BetsController {
    private readonly betsService;
    constructor(betsService: BetsService);
    placeBet(req: any, body: {
        matchId: string;
        matchName: string;
        league?: string;
        market: string;
        selection: string;
        oddsType: 'Back' | 'Lay';
        odds: number;
        stake: number;
    }): Promise<{
        bet: {
            id: number;
            matchName: string;
            selection: string;
            oddsType: string;
            odds: number;
            stake: number;
            potentialWin: number;
            status: import(".prisma/client").$Enums.BetStatus;
            createdAt: Date;
        };
        newBalance: number;
    }>;
    getMyBets(req: any, page?: string, limit?: string): Promise<{
        bets: {
            odds: number;
            stake: number;
            potentialWin: number;
            id: number;
            createdAt: Date;
            matchId: string;
            matchName: string;
            league: string;
            market: string;
            selection: string;
            oddsType: string;
            status: import(".prisma/client").$Enums.BetStatus;
            settledAt: Date | null;
        }[];
        total: number;
        page: number;
        pages: number;
    }>;
    getMyTransactions(req: any, page?: string): Promise<{
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        id: number;
        createdAt: Date;
        playerId: number;
        type: string;
        ref: string | null;
        note: string | null;
    }[]>;
}
