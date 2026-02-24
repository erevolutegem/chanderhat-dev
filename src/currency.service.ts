import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class CurrencyService {
    constructor(private readonly prisma: PrismaService) { }

    async getAllCurrencies() {
        return this.prisma.currency.findMany();
    }

    async createCurrency(code: string, symbol: string, rate: number) {
        return this.prisma.currency.create({
            data: { code, symbol, rate }
        });
    }

    async setSiteCurrency(siteId: number, currencyId: number, isDefault: boolean) {
        // If isDefault is true, unset other defaults for this site
        if (isDefault) {
            await this.prisma.siteCurrency.updateMany({
                where: { siteId },
                data: { isDefault: false }
            });
        }

        return this.prisma.siteCurrency.upsert({
            where: {
                siteId_currencyId: { siteId, currencyId }
            },
            update: { isDefault },
            create: { siteId, currencyId, isDefault }
        });
    }

    async getSiteCurrencies(siteId: number) {
        return this.prisma.siteCurrency.findMany({
            where: { siteId },
            include: { currency: true }
        });
    }
}
