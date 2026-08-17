import { apiUrl } from '../config/api-url'

export async function reportApplicationVisit(request: typeof fetch = fetch): Promise<void> {
  try {
    await request(apiUrl('/api/telemetry/visits'), {
      method: 'POST',
      keepalive: true,
    })
  } catch {
    // La telemetría no debe impedir que el usuario use el checkout.
  }
}
