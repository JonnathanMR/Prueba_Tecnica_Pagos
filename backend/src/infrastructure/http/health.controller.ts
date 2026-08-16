import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  GetHealthStatusUseCase,
  HealthStatus,
} from '../../application/health/get-health-status.use-case';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(private readonly getHealthStatus: GetHealthStatusUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Check API availability' })
  @ApiOkResponse({ description: 'The API is available.' })
  getHealth(): HealthStatus {
    return this.getHealthStatus.execute();
  }
}
