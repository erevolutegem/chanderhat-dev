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

import { PrismaService } from './prisma.service';
import { SiteService } from './site.service';
import { SiteController } from './site.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    HttpModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController, GamesController, SiteController],
  providers: [AppService, EventsGateway, RedisService, BetsApiService, PrismaService, SiteService],
})
export class AppModule { }
