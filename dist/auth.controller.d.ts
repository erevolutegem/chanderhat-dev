import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(body: {
        email: string;
        username: string;
        password: string;
    }): Promise<{
        token: string;
        player: {
            id: number;
            email: string;
            username: string;
            balance: number;
        };
    }>;
    login(body: {
        email: string;
        password: string;
    }): Promise<{
        token: string;
        player: {
            id: number;
            email: string;
            username: string;
            balance: number;
        };
    }>;
    getMe(req: any): Promise<{
        balance: number;
        id: number;
        createdAt: Date;
        email: string;
        username: string;
    }>;
}
