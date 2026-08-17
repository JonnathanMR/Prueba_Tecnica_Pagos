import { describe, expect, it, vi } from 'vitest'

import { reportApplicationVisit } from './usage-telemetry'

describe('reportApplicationVisit', () => {
  it('reports one anonymous visit without blocking the application', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))

    await reportApplicationVisit(request)

    expect(request).toHaveBeenCalledWith('/api/telemetry/visits', {
      method: 'POST',
      keepalive: true,
    })
  })

  it('ignores telemetry failures', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error('Network error'))

    await expect(reportApplicationVisit(request)).resolves.toBeUndefined()
  })
})
