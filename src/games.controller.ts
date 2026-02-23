import { Controller, Get, Query } from '@nestjs/common';
import { BetsApiService } from './bets-api.service';

@Controller('games')
export class GamesController {
    constructor(private readonly betsApiService: BetsApiService) { }

    @Get('live')
    async getLiveGames(@Query('sportId') sportId: string) {
        const id = sportId ? parseInt(sportId, 10) : 1;
        return this.betsApiService.getLiveGames(id);
    }
}
