import { SiteService } from './site.service';
import type { Request } from 'express';
export declare class SiteController {
    private readonly siteService;
    constructor(siteService: SiteService);
    getConfig(req: Request): Promise<any>;
}
