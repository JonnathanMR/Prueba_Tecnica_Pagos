import { Module } from '@nestjs/common';

/**
 * Punto de composición para los adaptadores de persistencia.
 * Las implementaciones PostgreSQL se registrarán aquí en la tarea de migraciones.
 */
@Module({})
export class PersistenceModule {}
