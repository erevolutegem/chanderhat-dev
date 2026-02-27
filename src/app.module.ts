import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsGateway } from './events.gateway';
import { BetsApiService } from './bets-api.service';
import { GamesController } from './games.controller';
import { LiveScoresService } from './live-scores.service';
import { PrismaService } from './prisma.service';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { OwnerService } from './owner.service';
import { OwnerController } from './owner.controller';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './owner.controller';

/**
 * AppModule — no Redis, no BullMQ.
 * Live score polling: setInterval (LiveScoresService)
 * Caching: in-memory Map with TTL (inside BetsApiService)
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    HttpModule,
  ],
  controllers: [AppController, GamesController, SiteController, OwnerController, CurrencyController],
  providers: [
    AppService,
    EventsGateway,
    BetsApiService,
    LiveScoresService,   // setInterval-based poller (replaces BullMQ worker)
    PrismaService,
    SiteService,
    OwnerService,
    CurrencyService,
  ],
})
export class AppModule { }
