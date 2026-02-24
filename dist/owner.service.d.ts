import { PrismaService } from './prisma.service';
export declare class OwnerService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSitesByOwner(ownerId: number): Promise<({
        currencies: ({
            currency: {
                symbol: string;
                id: number;
                createdAt: Date;
                updatedAt: Date;
                code: string;
                rate: number;
            };
        } & {
            id: number;
            createdAt: Date;
            updatedAt: Date;
            siteId: number;
            isDefault: boolean;
            currencyId: number;
        })[];
    } & {
        id: number;
        domain: string;
        name: string;
        template: string;
        logoUrl: string | null;
        config: import("@prisma/client/runtime/library").JsonValue | null;
        isActive: boolean;
        ownerId: number | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    getOwnerStats(ownerId: number): Promise<{
        totalSites: number;
        activeSites: number;
        totalUsers: number;
        revenueToday: number;
    }>;
}
