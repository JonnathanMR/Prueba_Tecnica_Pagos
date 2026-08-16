import { Module } from '@nestjs/common';

import { CheckoutModule } from '../../application/checkout/checkout.module';
import { GetHealthStatusUseCase } from '../../application/health/get-health-status.use-case';
import { CheckoutController } from './checkout.controller';
import { HealthController } from './health.controller';
import { ProductsController } from './products.controller';

@Module({
  imports: [CheckoutModule],
  controllers: [HealthController, ProductsController, CheckoutController],
  providers: [GetHealthStatusUseCase],
})
export class HttpModule {}
