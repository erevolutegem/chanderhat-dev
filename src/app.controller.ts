import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { EventsGateway } from './events.gateway';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
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

    return {
      status: 'ok',
      build: 'v12.0.0',
      timestamp: new Date().toISOString(),
      services: {
        api: 'ok',
        database: { status: dbStatus, provider: 'postgresql' },
        redis: { mode: 'redis-adapter', status: 'ok' },
        socket: {
          status: 'ok',
          connectedClients: this.eventsGateway.getConnectedClients(),
          namespace: '/live',
        }
      },
    };
  }
}
