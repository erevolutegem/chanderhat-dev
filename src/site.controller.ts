import { Controller, Get, Req } from '@nestjs/common';
import { SiteService } from './site.service';
import type { Request } from 'express';

@Controller('v1/site')
export class SiteController {
    constructor(private readonly siteService: SiteService) { }

    @Get('config')
    async getConfig(@Req() req: Request) {
        const host = req.headers.host || 'unknown';
        // Remove port if present
        const domain = host.split(':')[0];
        return this.siteService.getConfigByDomain(domain);
    }
}
