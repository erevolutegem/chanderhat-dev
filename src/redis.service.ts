import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redisClient: Redis;

    constructor(private configService: ConfigService) {
        const redisUrl = this.configService.get<string>('REDIS_URL');
        if (!redisUrl) {
            throw new Error('REDIS_URL is not defined in environment variables');
        }
        this.redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
        });
    }

    onModuleInit() {
        // Optional: Add listeners if needed
    }

    onModuleDestroy() {
        this.redisClient.disconnect();
    }

    getClient(): Redis {
        return this.redisClient;
    }
}
