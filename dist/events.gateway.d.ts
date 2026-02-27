import { OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    private connectedClients;
    afterInit(_server: Server): void;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleSubscribeSport(data: {
        sportId: number;
    }, client: Socket): void;
    handleUnsubscribeSport(data: {
        sportId: number;
    }, client: Socket): void;
    pushLiveUpdate(sportId: number | null, matches: any[]): void;
    getConnectedClients(): number;
}
