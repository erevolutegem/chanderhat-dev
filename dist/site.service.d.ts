import { PrismaService } from './prisma.service';
export declare class SiteService {
    private readonly prisma;
    private readonly logger;
    private readonly memCache;
    constructor(prisma: PrismaService);
    getConfigByDomain(domain: string): Promise<any>;
}
