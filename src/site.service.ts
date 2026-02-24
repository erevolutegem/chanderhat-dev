import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Injectable()
export class SiteService {
    private readonly logger = new Logger(SiteService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly redisService: RedisService,
    ) { }

    async getConfigByDomain(domain: string): Promise<any> {
        const redisClient = this.redisService.getClient();
        const cacheKey = `site:config:${domain}`;

        try {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
        } catch (err) { }

        // Find site by domain
        let site = await this.prisma.site.findUnique({
            where: { domain },
            include: {
                currencies: {
                    include: { currency: true }
                }
            }
        });

        // Default to Playbaji if no site found
        if (!site) {
            this.logger.warn(`No site found for domain: ${domain}. Using default Playbaji config.`);
            const defaultCurrency = { code: 'BDT', symbol: '৳', rate: 1.0 };
            site = {
                id: 0,
                domain,
                name: 'Playbaji',
                template: 'playbaji',
                logoUrl: null,
                config: {
                    colors: {
                        primary: '#0b1624',
                        accent: '#ffc107'
                    }
                },
                currencies: [{ isDefault: true, currency: defaultCurrency }],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            } as any;
        }

        if (site.isActive) {
            await redisClient.set(cacheKey, JSON.stringify(site), 'EX', 60).catch(() => { });
        }

        return site;
    }
}
