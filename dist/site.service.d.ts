import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
export declare class SiteService {
    private readonly prisma;
    private readonly redisService;
    private readonly logger;
    constructor(prisma: PrismaService, redisService: RedisService);
    getConfigByDomain(domain: string): Promise<any>;
}
