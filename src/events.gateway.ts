import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
    cors: { origin: '*' },
    namespace: '/live',
    transports: ['websocket', 'polling'],
})
export class EventsGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(EventsGateway.name);
    private connectedClients = 0;

    constructor(
        @InjectQueue('live-scores') private readonly liveScoresQueue: Queue,
    ) { }

    afterInit(server: Server) {
        this.logger.log('Socket.io Gateway initialized ✅');
    }

    handleConnection(client: Socket) {
        this.connectedClients++;
        this.logger.log(`Client connected: ${client.id} | Total: ${this.connectedClients}`);
        // Send current state immediately on connect
        client.emit('connected', { message: 'Connected to Chanderhat live feed', timestamp: new Date().toISOString() });
    }

    handleDisconnect(client: Socket) {
        this.connectedClients--;
        this.logger.log(`Client disconnected: ${client.id} | Total: ${this.connectedClients}`);
    }

    // Client subscribes to a specific sport
    @SubscribeMessage('subscribe:sport')
    handleSubscribeSport(@MessageBody() data: { sportId: number }, @ConnectedSocket() client: Socket) {
        const room = `sport:${data.sportId}`;
        client.join(room);
        client.emit('subscribed', { room, sportId: data.sportId });
        this.logger.log(`Client ${client.id} subscribed to ${room}`);
    }

    @SubscribeMessage('unsubscribe:sport')
    handleUnsubscribeSport(@MessageBody() data: { sportId: number }, @ConnectedSocket() client: Socket) {
        const room = `sport:${data.sportId}`;
        client.leave(room);
    }

    // Called by the BullMQ worker to push live updates
    pushLiveUpdate(sportId: number | null, matches: any[]) {
        if (sportId) {
            // Push to subscribers of this specific sport
            this.server.to(`sport:${sportId}`).emit('live:update', { sportId, matches, timestamp: new Date().toISOString() });
        }
        // Also push to global 'all' subscribers
        this.server.emit('live:update:all', { matches, timestamp: new Date().toISOString() });
    }

    getConnectedClients(): number {
        return this.connectedClients;
    }
}
