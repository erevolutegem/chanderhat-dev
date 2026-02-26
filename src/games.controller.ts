import { Controller, Get, Query, Param } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';

@Controller('games')
export class GamesController {
    constructor(private readonly betsApiService: BetsApiService) { }

    @Get('live')
    async getLiveGames(@Query('sportId') sportId?: string) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        return this.betsApiService.getLiveGames(id);
    }

    @Get('details/:id')
    async getGameDetails(@Param('id') id: string) {
        return this.betsApiService.getGameDetails(id);
    }

    @Get('upcoming')
    async getUpcomingGames(
        @Query('sportId') sportId?: string,
        @Query('date') date?: string,
    ) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        return this.betsApiService.getUpcomingGames(id, date ?? 'today');
    }
}
