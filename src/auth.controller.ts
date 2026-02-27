import { Controller, Post, Get, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() body: { email: string; username: string; password: string }) {
        return this.authService.register(body.email, body.username, body.password);
    }

    @Post('login')
    @HttpCode(200)
    async login(@Body() body: { email: string; password: string }) {
        return this.authService.login(body.email, body.password);
    }

    @Get('me')
    @UseGuards(JwtGuard)
    async getMe(@Req() req: any) {
        return this.authService.getProfile(req.player.sub);
    }
}
