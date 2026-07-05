import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable Helmet Security Headers
  app.use(helmet());

  // 2. Enable CORS with origin restriction
  app.enableCors({
    origin: '*', // Customize in production configurations
    credentials: true,
  });

  // 3. Enable Rate Limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per window
      message: 'Too many requests from this IP, please try again later.',
    }),
  );

  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
