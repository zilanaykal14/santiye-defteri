import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(prefix = ''): string {
  const r =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}${r}`
}

/** Tek sayfa önizleme derlemesi (dosya indirme / yazdırma gömülü görünümde çalışmaz) */
export const IS_PREVIEW = !!import.meta.env.VITE_HASH_ROUTER
