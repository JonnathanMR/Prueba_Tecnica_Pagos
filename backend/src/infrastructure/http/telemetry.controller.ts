import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';

@Controller('telemetry')
@ApiTags('Telemetry')
export class TelemetryController {
  @Post('visits')
  @HttpCode(204)
  @ApiExcludeEndpoint()
  recordVisit(): void {}
}
