import { describe, it, expect } from 'vitest'
import { sha256 } from '../hash'

describe('sha256', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const result = await sha256('hello')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  it('returns the same hash for the same input', async () => {
    const a = await sha256('competitive intelligence')
    const b = await sha256('competitive intelligence')
    expect(a).toBe(b)
  })

  it('returns different hashes for different inputs', async () => {
    const a = await sha256('foo')
    const b = await sha256('bar')
    expect(a).not.toBe(b)
  })
})
