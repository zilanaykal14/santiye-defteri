import { describe, expect, it } from 'vitest'
import { canAdd, canEdit, canSee, firstAllowedPath, hashPassword, verifyPassword } from './auth'
import { SEED_USERS } from '@/data/seed'

const [admin, sef, muh] = SEED_USERS

describe('yetkiler', () => {
  it('yönetici her yere girer', () => {
    expect(canSee(admin, 'mahsuplasma')).toBe(true)
    expect(canSee(admin, 'kullanicilar')).toBe(true)
  })
  it('şantiye şefi sadece izin verilen sayfalara girer', () => {
    expect(canSee(sef, 'gunluk')).toBe(true)
    expect(canSee(sef, 'mahsuplasma')).toBe(false)
    expect(canSee(sef, 'kullanicilar')).toBe(false)
    expect(canAdd(sef)).toBe(true)
    expect(canEdit(sef)).toBe(false)
    expect(firstAllowedPath(sef)).toBe('/gunluk')
  })
  it('kapalı hesap hiçbir yere giremez', () => {
    expect(canSee({ ...muh, active: false }, 'dashboard')).toBe(false)
  })
})

describe('şifre', () => {
  it('demo şifreleri doğrular, yanlışı reddeder', async () => {
    expect(await verifyPassword(admin, '1234')).toBe(true)
    expect(await verifyPassword(sef, '1111')).toBe(true)
    expect(await verifyPassword(muh, '2222')).toBe(true)
    expect(await verifyPassword(admin, '1111')).toBe(false)
  })
  it('aynı şifre farklı tuzla farklı özet verir', async () => {
    expect(await hashPassword('a', 'x')).not.toBe(await hashPassword('b', 'x'))
  })
})
