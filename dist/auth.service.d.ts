import { PrismaService } from './prisma.service';
export interface JwtPayload {
    sub: number;
    email: string;
    username: string;
}
export declare class AuthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private get jwtSecret();
    private signToken;
    register(email: string, username: string, password: string): Promise<{
        token: string;
        player: {
            id: number;
            email: string;
            username: string;
            balance: number;
        };
    }>;
    login(emailOrUsername: string, password: string): Promise<{
        token: string;
        player: {
            id: number;
            email: string;
            username: string;
            balance: number;
        };
    }>;
    verifyToken(token: string): JwtPayload;
    getProfile(playerId: number): Promise<{
        balance: number;
        id: number;
        createdAt: Date;
        email: string;
        username: string;
    }>;
}
