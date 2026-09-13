import { describe, it, expect } from 'vitest'
import { clearAllCloudData, clearTransactionRecords } from '../../lib/syncService'

describe('Data Clearing & Reset Resilience', () => {
  it('clearAllCloudData executes without unhandled exceptions', async () => {
    const result = await clearAllCloudData()
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })

  it('clearTransactionRecords executes without unhandled exceptions', async () => {
    const result = await clearTransactionRecords()
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })
})
