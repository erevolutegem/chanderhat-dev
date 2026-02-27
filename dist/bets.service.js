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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const library_1 = require("@prisma/client/runtime/library");
let BetsService = class BetsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async placeBet(playerId, dto) {
        const { matchId, matchName, league, market, selection, oddsType, odds, stake } = dto;
        if (!matchId || !selection || !odds || !stake) {
            throw new common_1.BadRequestException('Missing required bet fields');
        }
        if (stake < 10)
            throw new common_1.BadRequestException('Minimum stake is ৳10');
        if (stake > 100_000)
            throw new common_1.BadRequestException('Maximum stake is ৳100,000');
        if (odds < 1.01 || odds > 1000)
            throw new common_1.BadRequestException('Invalid odds');
        if (!['Back', 'Lay'].includes(oddsType))
            throw new common_1.BadRequestException('Invalid odds type');
        const stakeDecimal = new library_1.Decimal(stake.toFixed(2));
        const oddsDecimal = new library_1.Decimal(odds.toFixed(4));
        const potentialWin = oddsType === 'Back'
            ? stakeDecimal.mul(oddsDecimal.sub(1))
            : stakeDecimal;
        return this.prisma.$transaction(async (tx) => {
            const player = await tx.player.findUnique({ where: { id: playerId } });
            if (!player)
                throw new common_1.NotFoundException('Player not found');
            if (!player.isActive)
                throw new common_1.ForbiddenException('Account suspended');
            const balance = new library_1.Decimal(player.balance.toString());
            if (balance.lt(stakeDecimal)) {
                throw new common_1.BadRequestException(`Insufficient balance. Required: ৳${stake}, Available: ৳${balance.toFixed(2)}`);
            }
            const balanceBefore = balance;
            const balanceAfter = balance.sub(stakeDecimal);
            await tx.player.update({
                where: { id: playerId },
                data: { balance: balanceAfter },
            });
            const bet = await tx.bet.create({
                data: {
                    playerId,
                    matchId,
                    matchName,
                    league: league ?? '',
                    market,
                    selection,
                    oddsType,
                    odds: oddsDecimal,
                    stake: stakeDecimal,
                    potentialWin,
                    status: 'PENDING',
                },
            });
            await tx.transaction.create({
                data: {
                    playerId,
                    type: 'BET_PLACED',
                    amount: stakeDecimal.neg(),
                    balanceBefore,
                    balanceAfter,
                    ref: String(bet.id),
                    note: `Bet on ${matchName} — ${selection} @ ${odds}`,
                },
            });
            return {
                bet: {
                    id: bet.id,
                    matchName: bet.matchName,
                    selection: bet.selection,
                    oddsType: bet.oddsType,
                    odds: bet.odds.toNumber(),
                    stake: bet.stake.toNumber(),
                    potentialWin: bet.potentialWin.toNumber(),
                    status: bet.status,
                    createdAt: bet.createdAt,
                },
                newBalance: balanceAfter.toNumber(),
            };
        });
    }
    async getMyBets(playerId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [bets, total] = await Promise.all([
            this.prisma.bet.findMany({
                where: { playerId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true, matchId: true, matchName: true, league: true,
                    market: true, selection: true, oddsType: true,
                    odds: true, stake: true, potentialWin: true,
                    status: true, createdAt: true, settledAt: true,
                },
            }),
            this.prisma.bet.count({ where: { playerId } }),
        ]);
        return {
            bets: bets.map(b => ({
                ...b,
                odds: b.odds.toNumber(),
                stake: b.stake.toNumber(),
                potentialWin: b.potentialWin.toNumber(),
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    }
    async getMyTransactions(playerId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const txns = await this.prisma.transaction.findMany({
            where: { playerId },
            orderBy: { createdAt: 'desc' },
            skip, take: limit,
        });
        return txns.map(t => ({
            ...t,
            amount: t.amount.toNumber(),
            balanceBefore: t.balanceBefore.toNumber(),
            balanceAfter: t.balanceAfter.toNumber(),
        }));
    }
};
exports.BetsService = BetsService;
exports.BetsService = BetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BetsService);
//# sourceMappingURL=bets.service.js.map