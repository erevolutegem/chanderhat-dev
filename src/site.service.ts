import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class SiteService {
    private readonly logger = new Logger(SiteService.name);
    private readonly memCache = new Map<string, { data: any; expiresAt: number }>();

    constructor(
        private readonly prisma: PrismaService,
    ) { }

    async getConfigByDomain(domain: string): Promise<any> {
        const cacheKey = `site:config:${domain}`;

        const cached = this.memCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }

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

        if (site && site.isActive) {
            this.memCache.set(cacheKey, { data: site, expiresAt: Date.now() + 60000 });
        }

        return site;
    }
}
