import { Module } from '@nestjs/common';

import { GetHealthStatusUseCase } from '../../application/health/get-health-status.use-case';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [GetHealthStatusUseCase],
})
export class HttpModule {}
