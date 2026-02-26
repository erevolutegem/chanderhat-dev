import { Controller, Get, Query, Param } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';

@Controller('games')
export class GamesController {
    constructor(private readonly betsApiService: BetsApiService) { }

    // Health check so we can verify which build is running
    @Get('health')
    getHealth() {
        return { status: 'ok', build: 'v11.0.0', timestamp: new Date().toISOString() };
    }

    // Main live games endpoint — also handles today/tomorrow via `tab` param
    @Get('live')
    async getLiveGames(
        @Query('sportId') sportId?: string,
        @Query('tab') tab?: string,
    ) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        if (tab === 'today' || tab === 'tomorrow') {
            return this.betsApiService.getUpcomingGames(id, tab);
        }
        return this.betsApiService.getLiveGames(id);
    }

    @Get('details/:id')
    async getGameDetails(@Param('id') id: string) {
        return this.betsApiService.getGameDetails(id);
    }

    // Keep /upcoming as alias for backward compat
    @Get('upcoming')
    async getUpcomingGames(
        @Query('sportId') sportId?: string,
        @Query('date') date?: string,
    ) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        return this.betsApiService.getUpcomingGames(id, date ?? 'today');
    }
}
