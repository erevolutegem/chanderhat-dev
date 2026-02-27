import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class JwtGuard implements CanActivate {
    constructor(private readonly authService: AuthService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader: string = request.headers['authorization'] ?? '';

        if (!authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing auth token');
        }

        const token = authHeader.slice(7);
        const payload = this.authService.verifyToken(token); // throws if invalid
        request.player = payload; // { sub, email, username }
        return true;
    }
}
