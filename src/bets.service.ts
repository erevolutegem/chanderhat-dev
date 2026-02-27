import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

interface PlaceBetDto {
    matchId: string;
    matchName: string;
    league?: string;
    market: string;
    selection: string;
    oddsType: 'Back' | 'Lay';
    odds: number;
    stake: number;
}

@Injectable()
export class BetsService {
    constructor(private readonly prisma: PrismaService) { }

    async placeBet(playerId: number, dto: PlaceBetDto) {
        const { matchId, matchName, league, market, selection, oddsType, odds, stake } = dto;

        // ── Validation ──────────────────────────────────────────
        if (!matchId || !selection || !odds || !stake) {
            throw new BadRequestException('Missing required bet fields');
        }
        if (stake < 10) throw new BadRequestException('Minimum stake is ৳10');
        if (stake > 100_000) throw new BadRequestException('Maximum stake is ৳100,000');
        if (odds < 1.01 || odds > 1000) throw new BadRequestException('Invalid odds');
        if (!['Back', 'Lay'].includes(oddsType)) throw new BadRequestException('Invalid odds type');

        const stakeDecimal = new Decimal(stake.toFixed(2));
        const oddsDecimal = new Decimal(odds.toFixed(4));
        const potentialWin = oddsType === 'Back'
            ? stakeDecimal.mul(oddsDecimal.sub(1))   // profit if win
            : stakeDecimal;                           // lay: winnings = stake

        // ── Prisma transaction: check balance + create bet + debit ───
        return this.prisma.$transaction(async (tx) => {
            const player = await tx.player.findUnique({ where: { id: playerId } });
            if (!player) throw new NotFoundException('Player not found');
            if (!player.isActive) throw new ForbiddenException('Account suspended');

            const balance = new Decimal(player.balance.toString());
            if (balance.lt(stakeDecimal)) {
                throw new BadRequestException(`Insufficient balance. Required: ৳${stake}, Available: ৳${balance.toFixed(2)}`);
            }

            const balanceBefore = balance;
            const balanceAfter = balance.sub(stakeDecimal);

            // Deduct stake from balance
            await tx.player.update({
                where: { id: playerId },
                data: { balance: balanceAfter },
            });

            // Create bet record
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

            // Create transaction record
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

    async getMyBets(playerId: number, page = 1, limit = 20) {
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

    async getMyTransactions(playerId: number, page = 1, limit = 20) {
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
}
