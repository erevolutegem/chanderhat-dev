import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redisClient: Redis;

    constructor(private configService: ConfigService) {
        this.redisClient = new Redis(this.configService.get<string>('REDIS_URL'), {
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
