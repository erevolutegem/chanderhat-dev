import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { EventsGateway } from './events.gateway';
export declare class AppController {
    private readonly appService;
    private readonly prismaService;
    private readonly eventsGateway;
    constructor(appService: AppService, prismaService: PrismaService, eventsGateway: EventsGateway);
    getHello(): string;
    getHealth(): Promise<{
        status: string;
        build: string;
        timestamp: string;
        services: {
            api: string;
            database: {
                status: string;
                provider: string;
            };
            redis: {
                mode: string;
                status: string;
            };
            socket: {
                status: string;
                connectedClients: number;
                namespace: string;
            };
        };
    }>;
}
