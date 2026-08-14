export interface HealthStatus {
  readonly status: 'ok';
}

/** Caso de uso mínimo para verificar que la aplicación está disponible. */
export class GetHealthStatusUseCase {
  execute(): HealthStatus {
    return { status: 'ok' };
  }
}
