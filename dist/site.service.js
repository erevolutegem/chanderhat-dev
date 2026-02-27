"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SiteService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
let SiteService = SiteService_1 = class SiteService {
    prisma;
    logger = new common_1.Logger(SiteService_1.name);
    memCache = new Map();
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getConfigByDomain(domain) {
        const cacheKey = `site:config:${domain}`;
        const cached = this.memCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        let site = await this.prisma.site.findUnique({
            where: { domain },
            include: {
                currencies: {
                    include: { currency: true }
                }
            }
        });
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
            };
        }
        if (site && site.isActive) {
            this.memCache.set(cacheKey, { data: site, expiresAt: Date.now() + 60000 });
        }
        return site;
    }
};
exports.SiteService = SiteService;
exports.SiteService = SiteService = SiteService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SiteService);
//# sourceMappingURL=site.service.js.map