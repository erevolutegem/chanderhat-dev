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

/**
 * EventsGateway — Socket.io server for live match updates.
 * No BullMQ dependency. Receives push calls from LiveScoresService.
 */
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

    afterInit(_server: Server) {
        this.logger.log('Socket.io Gateway initialized ✅');
    }

    handleConnection(client: Socket) {
        this.connectedClients++;
        client.emit('connected', {
            message: 'Connected to Chanderhat live feed',
            timestamp: new Date().toISOString(),
        });
        this.logger.log(`Client connected: ${client.id} | Total: ${this.connectedClients}`);
    }

    handleDisconnect(client: Socket) {
        this.connectedClients--;
        this.logger.log(`Client disconnected: ${client.id} | Total: ${this.connectedClients}`);
    }

    @SubscribeMessage('subscribe:sport')
    handleSubscribeSport(
        @MessageBody() data: { sportId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const room = `sport:${data.sportId}`;
        client.join(room);
        client.emit('subscribed', { room, sportId: data.sportId });
    }

    @SubscribeMessage('unsubscribe:sport')
    handleUnsubscribeSport(
        @MessageBody() data: { sportId: number },
        @ConnectedSocket() client: Socket,
    ) {
        client.leave(`sport:${data.sportId}`);
    }

    /** Called by LiveScoresService to push updates to Socket.io clients */
    pushLiveUpdate(sportId: number | null, matches: any[]) {
        if (!this.server) return;

        const payload = { matches, timestamp: new Date().toISOString() };

        if (sportId !== null) {
            this.server.to(`sport:${sportId}`).emit('live:update', { sportId, ...payload });
        }
        this.server.emit('live:update:all', payload);
    }

    getConnectedClients(): number {
        return this.connectedClients;
    }
}
