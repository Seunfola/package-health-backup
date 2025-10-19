"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
require("dotenv/config");
const swagger_1 = require("@nestjs/swagger");
const tls_1 = require("tls");
tls_1.TLSSocket.prototype.setMaxListeners(50);
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const isProduction = process.env.NODE_ENV === 'production';
    const corsOrigin = isProduction
        ? process.env.CORS_ORIGIN_PROD
        : process.env.CORS_ORIGIN_DEV;
    if (!corsOrigin) {
        throw new Error(`CORS_ORIGIN_${isProduction ? 'PROD' : 'DEV'} is not set!`);
    }
    app.enableCors({
        origin: corsOrigin,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Package Health API')
        .setDescription('API to analyze GitHub repos, package.json, and user profiles')
        .setVersion('1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api', app, document);
    await app.init();
    return app;
}
const appPromise = bootstrap();
if (process.env.NODE_ENV !== 'production') {
    (async () => {
        const app = await appPromise;
        const port = process.env.PORT ?? 8000;
        void app.listen(port, () => {
            console.log(`🚀 Server running on http://localhost:${port}`);
            console.log(`📖 Swagger docs available at http://localhost:${port}/api`);
        });
    })().catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}
exports.default = appPromise.then((app) => app.getHttpAdapter().getInstance());
//# sourceMappingURL=main.js.map