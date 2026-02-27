import { PrismaService } from './prisma.service';
interface PlaceBetDto {
    matchId: string;
    matchName: string;
    league?: string;
    market: string;
    selection: string;
    oddsType: 'Back' | 'Lay';
    odds: number;
    stake: number;
}
export declare class BetsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    placeBet(playerId: number, dto: PlaceBetDto): Promise<{
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
    getMyBets(playerId: number, page?: number, limit?: number): Promise<{
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
    getMyTransactions(playerId: number, page?: number, limit?: number): Promise<{
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
export {};
