import { Controller, Get } from '@nestjs/common';

import {
  GetHealthStatusUseCase,
  HealthStatus,
} from '../../application/health/get-health-status.use-case';

@Controller('health')
export class HealthController {
  constructor(private readonly getHealthStatus: GetHealthStatusUseCase) {}

  @Get()
  getHealth(): HealthStatus {
    return this.getHealthStatus.execute();
  }
}
