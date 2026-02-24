import { OwnerService } from './owner.service';
import { CurrencyService } from './currency.service';
export declare class OwnerController {
    private readonly ownerService;
    private readonly currencyService;
    constructor(ownerService: OwnerService, currencyService: CurrencyService);
    getSites(): Promise<({
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
    getStats(): Promise<{
        totalSites: number;
        activeSites: number;
        totalUsers: number;
        revenueToday: number;
    }>;
    setupCurrency(data: {
        siteId: number;
        currencyId: number;
        isDefault: boolean;
    }): Promise<{
        id: number;
        createdAt: Date;
        updatedAt: Date;
        siteId: number;
        isDefault: boolean;
        currencyId: number;
    }>;
}
export declare class CurrencyController {
    private readonly currencyService;
    constructor(currencyService: CurrencyService);
    list(): Promise<{
        symbol: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        rate: number;
    }[]>;
    create(data: {
        code: string;
        symbol: string;
        rate: number;
    }): Promise<{
        symbol: string;
        id: number;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        rate: number;
    }>;
}
