import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { RedisService } from './redis.service';
import { PrismaService } from './prisma.service';
import { EventsGateway } from './events.gateway';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    // Check PostgreSQL
    let dbStatus = 'ok';
    try {
      await this.prismaService.$queryRaw`SELECT 1`;
    } catch (e: any) {
      dbStatus = `error: ${e.message}`;
    }

    const redisStatus = this.redisService.getStatus();

    return {
      status: 'ok',
      build: 'v12.0.0',
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: { status: dbStatus, provider: 'postgresql' },
        redis: { ...redisStatus, status: redisStatus.connected ? 'ok' : 'fallback (in-memory)' },
        socket: {
          status: 'ok',
          connectedClients: this.eventsGateway.getConnectedClients(),
          namespace: '/live',
        },
        bullmq: {
          status: 'ok',
          queue: 'live-scores',
          interval: '30s',
        },
      },
    };
  }
}
