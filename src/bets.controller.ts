import { Controller, Post, Get, Body, Req, UseGuards, Query } from '@nestjs/common';
import { BetsService } from './bets.service';
import { JwtGuard } from './jwt.guard';

@Controller('bets')
@UseGuards(JwtGuard)
export class BetsController {
    constructor(private readonly betsService: BetsService) { }

    /** POST /bets — place a bet */
    @Post()
    async placeBet(@Req() req: any, @Body() body: {
        matchId: string;
        matchName: string;
        league?: string;
        market: string;
        selection: string;
        oddsType: 'Back' | 'Lay';
        odds: number;
        stake: number;
    }) {
        return this.betsService.placeBet(req.player.sub, body);
    }

    /** GET /bets/my — my bet history */
    @Get('my')
    async getMyBets(
        @Req() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.betsService.getMyBets(
            req.player.sub,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    /** GET /bets/transactions — transaction history */
    @Get('transactions')
    async getMyTransactions(@Req() req: any, @Query('page') page?: string) {
        return this.betsService.getMyTransactions(
            req.player.sub,
            page ? parseInt(page, 10) : 1,
        );
    }
}
