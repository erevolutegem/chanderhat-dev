import { PrismaService } from './prisma.service';
export declare class CurrencyService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllCurrencies(): Promise<{
        symbol: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        rate: number;
    }[]>;
    createCurrency(code: string, symbol: string, rate: number): Promise<{
        symbol: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        rate: number;
    }>;
    setSiteCurrency(siteId: number, currencyId: number, isDefault: boolean): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        siteId: number;
        currencyId: number;
        isDefault: boolean;
    }>;
    getSiteCurrencies(siteId: number): Promise<({
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
        currencyId: number;
        isDefault: boolean;
    })[]>;
}
