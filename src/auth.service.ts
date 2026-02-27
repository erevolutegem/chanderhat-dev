import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';

export interface JwtPayload {
    sub: number;  // player ID
    email: string;
    username: string;
}

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) { }

    private get jwtSecret(): string {
        return process.env.JWT_SECRET ?? 'chanderhat-dev-secret-change-in-prod';
    }

    private signToken(payload: JwtPayload): string {
        return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
    }

    async register(email: string, username: string, password: string) {
        // Validate inputs
        if (!email || !username || !password) throw new BadRequestException('All fields required');
        if (password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new BadRequestException('Username: 3-20 alphanumeric chars/underscores only');

        // Check duplicates
        const existing = await this.prisma.player.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existing) {
            if (existing.email === email) throw new ConflictException('Email already registered');
            throw new ConflictException('Username already taken');
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const player = await this.prisma.player.create({
            data: { email, username, passwordHash, balance: 0 },
        });

        const token = this.signToken({ sub: player.id, email: player.email, username: player.username });
        return {
            token,
            player: { id: player.id, email: player.email, username: player.username, balance: Number(player.balance) },
        };
    }

    async login(emailOrUsername: string, password: string) {
        const player = await this.prisma.player.findFirst({
            where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
        });
        if (!player) throw new UnauthorizedException('Invalid credentials');
        if (!player.isActive) throw new UnauthorizedException('Account suspended');

        const valid = await bcrypt.compare(password, player.passwordHash);
        if (!valid) throw new UnauthorizedException('Invalid credentials');

        const token = this.signToken({ sub: player.id, email: player.email, username: player.username });
        return {
            token,
            player: { id: player.id, email: player.email, username: player.username, balance: Number(player.balance) },
        };
    }

    verifyToken(token: string): JwtPayload {
        try {
            return jwt.verify(token, this.jwtSecret) as unknown as JwtPayload;
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    async getProfile(playerId: number) {
        const player = await this.prisma.player.findUnique({
            where: { id: playerId },
            select: { id: true, email: true, username: true, balance: true, createdAt: true },
        });
        if (!player) throw new UnauthorizedException('Player not found');
        return { ...player, balance: player.balance.toNumber() };
    }
}
