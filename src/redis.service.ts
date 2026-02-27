import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private redisClient: Redis | null = null;
    private isConnected = false;

    // In-memory fallback cache when Redis is unavailable
    private memCache: Map<string, { value: string; expiresAt: number }> = new Map();

    constructor(private configService: ConfigService) {
        const redisUrl = this.configService.get<string>('REDIS_URL');
        if (!redisUrl) {
            this.logger.warn('REDIS_URL not defined — using in-memory cache fallback.');
            return;
        }

        this.redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            retryStrategy: (times) => {
                if (times > 3) {
                    this.logger.warn('Redis retry limit reached — falling back to in-memory cache.');
                    return null; // stop retrying
                }
                return Math.min(times * 200, 2000);
            },
        });

        this.redisClient.on('connect', () => {
            this.isConnected = true;
            this.logger.log('Redis connected ✅');
        });

        this.redisClient.on('ready', () => {
            this.logger.log('Redis ready ✅');
            // Disable RDB write-blocking — critical for Docker/Coolify where disk
            // may be restricted. Prevents "MISCONF Redis is configured to save RDB
            // snapshots" 500 errors. Safe to ignore if not permitted.
            this.redisClient!.config('SET', 'stop-writes-on-bgsave-error', 'no')
                .then(() => this.logger.log('Redis: disabled stop-writes-on-bgsave-error ✅'))
                .catch((e) => this.logger.warn(`Redis CONFIG SET skipped: ${e.message}`));
            // Also disable RDB persistence entirely (no disk writes needed for cache/queue)
            this.redisClient!.config('SET', 'save', '')
                .catch(() => {/* ok if not permitted */ });
        });

        this.redisClient.on('error', (err) => {
            this.isConnected = false;
            this.logger.warn(`Redis error: ${err.message} — falling back to in-memory cache.`);
        });

        this.redisClient.on('close', () => {
            this.isConnected = false;
        });
    }

    onModuleInit() {
        this.logger.log(`Redis mode: ${this.redisClient ? 'ioredis' : 'in-memory fallback'}`);
    }

    onModuleDestroy() {
        this.redisClient?.disconnect();
    }

    // Resilient get — falls back to memory cache if Redis unavailable
    async get(key: string): Promise<string | null> {
        if (this.redisClient && this.isConnected) {
            try {
                return await this.redisClient.get(key);
            } catch {
                // fall through to memory cache
            }
        }
        const entry = this.memCache.get(key);
        if (entry && entry.expiresAt > Date.now()) return entry.value;
        this.memCache.delete(key);
        return null;
    }

    // Resilient set with TTL
    async set(key: string, value: string, mode?: 'EX', ttl?: number): Promise<void> {
        const ttlMs = (ttl ?? 60) * 1000;
        this.memCache.set(key, { value, expiresAt: Date.now() + ttlMs });

        if (this.redisClient && this.isConnected) {
            try {
                if (mode === 'EX' && ttl) {
                    await this.redisClient.set(key, value, 'EX', ttl);
                } else {
                    await this.redisClient.set(key, value);
                }
            } catch {
                // already stored in memory cache above
            }
        }
    }

    /** @deprecated Use get() and set() directly — they auto-fallback */
    getClient(): { get: (k: string) => Promise<string | null>; set: (k: string, v: string, mode?: 'EX', ttl?: number) => Promise<void> } {
        return { get: this.get.bind(this), set: this.set.bind(this) };
    }

    isRedisConnected(): boolean {
        return this.isConnected;
    }

    getStatus(): { mode: string; connected: boolean } {
        return {
            mode: this.redisClient ? 'ioredis' : 'memory',
            connected: this.isConnected,
        };
    }
}
