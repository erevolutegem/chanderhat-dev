"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    const port = process.env.PORT ?? 3000;
    logger.log(`Starting application on port ${port}...`);
    logger.log(`REDIS_URL: ${process.env.REDIS_URL ? 'DEFINED' : 'UNDEFINED'}`);
    logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'DEFINED' : 'UNDEFINED'}`);
    await app.listen(port, '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map