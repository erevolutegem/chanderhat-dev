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
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtGuard } from './jwt.guard';
import { BetsService } from './bets.service';
import { BetsController } from './bets.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    HttpModule,
  ],
  controllers: [
    AppController,
    GamesController,
    SiteController,
    OwnerController,
    CurrencyController,
    AuthController,
    BetsController,
  ],
  providers: [
    AppService,
    EventsGateway,
    BetsApiService,
    LiveScoresService,
    PrismaService,
    SiteService,
    OwnerService,
    CurrencyService,
    AuthService,
    JwtGuard,
    BetsService,
  ],
})
export class AppModule { }
