import { TelemetryController } from './telemetry.controller';

describe('TelemetryController', () => {
  it('accepts an application visit without a payload', () => {
    expect(new TelemetryController().recordVisit()).toBeUndefined();
  });
});
