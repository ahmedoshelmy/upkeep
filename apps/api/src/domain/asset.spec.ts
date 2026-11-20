import { createAsset, meterOf } from './asset'
import { DomainError } from './errors'
import { createRenewal, renew } from './renewal'

const now = new Date('2026-03-01T00:00:00Z')

describe('assets and renewals', () => {
  it('trims names and knows which meter an asset has', () => {
    expect(createAsset('a', 'CAR', '  Family hatchback ', now).name).toBe('Family hatchback')
    expect(meterOf('CAR')).toBe('ODOMETER_KM')
    expect(meterOf('HOME')).toBe('ELECTRICITY_KWH')
    expect(meterOf('APPLIANCE')).toBeNull()
    expect(() => createAsset('a', 'CAR', '  ', now)).toThrow(DomainError)
  })

  it('renews only forward', () => {
    const licence = createRenewal({
      id: 'r',
      assetId: 'a',
      kind: 'LICENSE',
      title: 'Car licence',
      expiresAt: new Date('2026-06-01T00:00:00Z'),
    })
    expect(renew(licence, new Date('2029-06-01T00:00:00Z')).expiresAt.getUTCFullYear()).toBe(2029)
    expect(() => renew(licence, new Date('2026-05-01T00:00:00Z'))).toThrow(DomainError)
    expect(() => createRenewal({ ...licence, expiresAt: new Date('nope') })).toThrow(DomainError)
  })
})
