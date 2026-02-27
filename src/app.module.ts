import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsGateway } from './events.gateway';
import { RedisService } from './redis.service';
import { BetsApiService } from './bets-api.service';
import { GamesController } from './games.controller';
import { LiveScoresProcessor } from './live-scores.processor';
import { PrismaService } from './prisma.service';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';
import { OwnerService } from './owner.service';
import { OwnerController } from './owner.controller';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './owner.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    // BullMQ — connects to Redis; if REDIS_URL is missing it will log a warning
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        return {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
            enableReadyCheck: false, // don't block startup waiting for Redis
            lazyConnect: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register the live-scores queue
    BullModule.registerQueue({ name: 'live-scores' }),
  ],
  controllers: [AppController, GamesController, SiteController, OwnerController, CurrencyController],
  providers: [
    AppService,
    EventsGateway,
    RedisService,
    BetsApiService,
    LiveScoresProcessor,    // BullMQ worker — polls BetsAPI + pushes to Socket.io
    PrismaService,
    SiteService,
    OwnerService,
    CurrencyService,
  ],
})
export class AppModule { }
