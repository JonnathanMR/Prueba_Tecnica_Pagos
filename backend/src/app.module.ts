import { Module } from '@nestjs/common';

import { HttpModule } from './infrastructure/http/http.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';

@Module({
  imports: [HttpModule, PersistenceModule],
})
export class AppModule {}
