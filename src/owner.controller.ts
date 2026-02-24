import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { OwnerService } from './owner.service';
import { CurrencyService } from './currency.service';

@Controller('v1/owner')
export class OwnerController {
    constructor(
        private readonly ownerService: OwnerService,
        private readonly currencyService: CurrencyService
    ) { }

    @Get('sites')
    async getSites() {
        // In a real app, we'd get ownerId from JWT
        const mockOwnerId = 1;
        return this.ownerService.getSitesByOwner(mockOwnerId);
    }

    @Get('stats')
    async getStats() {
        const mockOwnerId = 1;
        return this.ownerService.getOwnerStats(mockOwnerId);
    }

    @Post('currency/setup')
    async setupCurrency(@Body() data: { siteId: number, currencyId: number, isDefault: boolean }) {
        return this.currencyService.setSiteCurrency(data.siteId, data.currencyId, data.isDefault);
    }
}

@Controller('v1/currencies')
export class CurrencyController {
    constructor(private readonly currencyService: CurrencyService) { }

    @Get()
    async list() {
        return this.currencyService.getAllCurrencies();
    }

    @Post()
    async create(@Body() data: { code: string, symbol: string, rate: number }) {
        return this.currencyService.createCurrency(data.code, data.symbol, data.rate);
    }
}
