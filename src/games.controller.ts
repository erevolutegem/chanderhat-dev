import { Controller, Get, Query, Param } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';

@Controller('games')
export class GamesController {
    constructor(private readonly betsApiService: BetsApiService) { }

    @Get('health')
    getHealth() {
        return { status: 'ok', build: 'v12.0.0', timestamp: new Date().toISOString() };
    }

    // Main endpoint — handles inplay, today, tomorrow all via `tab` param
    @Get('live')
    async getLiveGames(
        @Query('sportId') sportId?: string,
        @Query('tab') tab?: string,
    ) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        // For today/tomorrow we still call getLiveGames (upcoming not available in API plan)
        return this.betsApiService.getLiveGames(id);
    }

    @Get('details/:id')
    async getGameDetails(@Param('id') id: string) {
        return this.betsApiService.getGameDetails(id);
    }

    // Backward compatibility alias
    @Get('upcoming')
    async getUpcomingGames(
        @Query('sportId') sportId?: string,
    ) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        return this.betsApiService.getLiveGames(id);
    }
}
