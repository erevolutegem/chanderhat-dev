import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class OwnerService {
    constructor(private readonly prisma: PrismaService) { }

    async getSitesByOwner(ownerId: number) {
        return this.prisma.site.findMany({
            where: { ownerId },
            include: {
                currencies: {
                    include: { currency: true }
                }
            }
        });
    }

    async getOwnerStats(ownerId: number) {
        const sites = await this.prisma.site.findMany({
            where: { ownerId }
        });

        // Mock stats for now
        return {
            totalSites: sites.length,
            activeSites: sites.filter(s => s.isActive).length,
            totalUsers: 1250, // Mock
            revenueToday: 5420.50 // Mock
        };
    }
}
