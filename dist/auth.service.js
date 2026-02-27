"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("./prisma.service");
const bcrypt = __importStar(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
let AuthService = class AuthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    get jwtSecret() {
        return process.env.JWT_SECRET ?? 'chanderhat-dev-secret-change-in-prod';
    }
    signToken(payload) {
        return jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
    }
    async register(email, username, password) {
        if (!email || !username || !password)
            throw new common_1.BadRequestException('All fields required');
        if (password.length < 6)
            throw new common_1.BadRequestException('Password must be at least 6 characters');
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
            throw new common_1.BadRequestException('Username: 3-20 alphanumeric chars/underscores only');
        const existing = await this.prisma.player.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existing) {
            if (existing.email === email)
                throw new common_1.ConflictException('Email already registered');
            throw new common_1.ConflictException('Username already taken');
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
    async login(emailOrUsername, password) {
        const player = await this.prisma.player.findFirst({
            where: { OR: [{ email: emailOrUsername }, { username: emailOrUsername }] },
        });
        if (!player)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (!player.isActive)
            throw new common_1.UnauthorizedException('Account suspended');
        const valid = await bcrypt.compare(password, player.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const token = this.signToken({ sub: player.id, email: player.email, username: player.username });
        return {
            token,
            player: { id: player.id, email: player.email, username: player.username, balance: Number(player.balance) },
        };
    }
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
    }
    async getProfile(playerId) {
        const player = await this.prisma.player.findUnique({
            where: { id: playerId },
            select: { id: true, email: true, username: true, balance: true, createdAt: true },
        });
        if (!player)
            throw new common_1.UnauthorizedException('Player not found');
        return { ...player, balance: player.balance.toNumber() };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map