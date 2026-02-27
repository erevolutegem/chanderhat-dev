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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamesController = void 0;
const common_1 = require("@nestjs/common");
const bets_api_service_1 = require("./bets-api.service");
let GamesController = class GamesController {
    betsApiService;
    constructor(betsApiService) {
        this.betsApiService = betsApiService;
    }
    getHealth() {
        return { status: 'ok', build: 'v12.0.0', timestamp: new Date().toISOString() };
    }
    async getLiveGames(sportId, tab) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        return this.betsApiService.getLiveGames(id);
    }
    async getGameDetails(id) {
        return this.betsApiService.getGameDetails(id);
    }
    async getUpcomingGames(sportId) {
        const id = sportId ? parseInt(sportId, 10) : undefined;
        return this.betsApiService.getLiveGames(id);
    }
};
exports.GamesController = GamesController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], GamesController.prototype, "getHealth", null);
__decorate([
    (0, common_1.Get)('live'),
    __param(0, (0, common_1.Query)('sportId')),
    __param(1, (0, common_1.Query)('tab')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getLiveGames", null);
__decorate([
    (0, common_1.Get)('details/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getGameDetails", null);
__decorate([
    (0, common_1.Get)('upcoming'),
    __param(0, (0, common_1.Query)('sportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GamesController.prototype, "getUpcomingGames", null);
exports.GamesController = GamesController = __decorate([
    (0, common_1.Controller)('games'),
    __metadata("design:paramtypes", [bets_api_service_1.BetsApiService])
], GamesController);
//# sourceMappingURL=games.controller.js.map