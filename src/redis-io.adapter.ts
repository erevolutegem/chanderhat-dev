import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter>;
    private readonly logger = new Logger(RedisIoAdapter.name);

    async connectToRedis(): Promise<void> {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

        // Create robust connections that don't crash the server if Redis misses a beat
        const pubClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
        });

        const subClient = pubClient.duplicate();

        pubClient.on('error', (err) => this.logger.error(`Redis Pub Client Error:`, err));
        subClient.on('error', (err) => this.logger.error(`Redis Sub Client Error:`, err));

        await Promise.all([
            new Promise<void>(resolve => pubClient.once('ready', () => {
                this.logger.log('Redis Pub Client Ready');
                pubClient.config('SET', 'stop-writes-on-bgsave-error', 'no').catch(e => this.logger.warn(`Failed to disable BGSAVE error: ${e.message}`));
                resolve();
            })),
            new Promise<void>(resolve => subClient.once('ready', () => {
                this.logger.log('Redis Sub Client Ready');
                subClient.config('SET', 'stop-writes-on-bgsave-error', 'no').catch(e => this.logger.warn(`Failed to disable BGSAVE error on subClient: ${e.message}`));
                resolve();
            }))
        ]);

        this.adapterConstructor = createAdapter(pubClient, subClient);
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
