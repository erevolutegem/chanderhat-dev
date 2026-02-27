"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
const common_1 = require("@nestjs/common");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    adapterConstructor;
    logger = new common_1.Logger(RedisIoAdapter.name);
    async connectToRedis() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        const pubClient = new ioredis_1.Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
        });
        const subClient = pubClient.duplicate();
        pubClient.on('error', (err) => this.logger.error(`Redis Pub Client Error:`, err));
        subClient.on('error', (err) => this.logger.error(`Redis Sub Client Error:`, err));
        await Promise.all([
            new Promise(resolve => pubClient.once('ready', () => {
                this.logger.log('Redis Pub Client Ready');
                resolve();
            })),
            new Promise(resolve => subClient.once('ready', () => {
                this.logger.log('Redis Sub Client Ready');
                resolve();
            }))
        ]);
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map