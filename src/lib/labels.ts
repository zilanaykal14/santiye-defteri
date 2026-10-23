import type { CostCategory, ExpenseCategory, ProjectStatus, TransactionKind } from '@/types'

export const COST_CATEGORIES: CostCategory[] = ['malzeme', 'taseron', 'resmi', 'lojistik']

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  malzeme: 'Malzeme',
  taseron: 'Taşeron & İşçilik',
  resmi: 'Ruhsat, Proje & Harçlar',
  lojistik: 'Lojistik & Genel Şantiye',
  dask: 'DASK',
  sigorta: 'Konut Sigortası',
  emlak_vergisi: 'Emlak Vergisi',
  tadilat: 'Demirbaş & Tadilat',
  aidat: 'Aidat',
  diger: 'Diğer',
}

export const CATEGORY_HINT: Partial<Record<ExpenseCategory, string>> = {
  malzeme: 'Demir, hazır beton, tuğla, çimento…',
  taseron: 'Kalıpçı, sıvacı, elektrikçi, tesisatçı…',
  resmi: 'Ruhsat, belediye, proje, noter, harç…',
  lojistik: 'Nakliye, vinç, şantiye elektrik/su, güvenlik…',
}

export const PROPERTY_CATEGORIES: ExpenseCategory[] = ['dask', 'sigorta', 'emlak_vergisi', 'tadilat', 'aidat', 'diger']

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planlama: 'Planlama',
  devam: 'Devam ediyor',
  beklemede: 'Beklemede',
  tamamlandi: 'Tamamlandı',
}

export const KIND_LABEL: Record<TransactionKind, string> = {
  gider: 'Gider',
  gelir: 'Gelir',
  sermaye: 'Kasaya Sermaye',
  mahsup: 'Ortaklar Arası Ödeme',
}

/** Kategori renkleri — tema token'ları (index.css) */
export const CATEGORY_COLOR: Record<CostCategory, string> = {
  malzeme: 'var(--chart-1)',
  taseron: 'var(--chart-2)',
  resmi: 'var(--chart-3)',
  lojistik: 'var(--chart-4)',
}
