/**
 * Alan modeli (domain model).
 *
 * PARA BİRİMİ KURALI: Tüm tutarlar `Kurus` tipinde, yani TAM SAYI kuruş olarak saklanır.
 * 100.000,00 TL  ->  10_000_000 kuruş. Kayan nokta (float) yuvarlama hataları
 * finansal yazılımda kabul edilemez; bu yüzden hesaplamalar tam sayı ile yapılır,
 * yalnızca ekranda TL'ye çevrilir.
 */

export type ID = string
/** Tam sayı kuruş. */
export type Kurus = number
/** ISO tarih: "2026-10-22" */
export type ISODate = string
/** Ay anahtarı: "2026-10" */
export type MonthKey = string
/** Hisse oranı, baz puan (bps): %50 = 5000, %100 = 10000. Toplam 10000 olmalı. */
export type Bps = number

// ─────────────────────────────── ORTAKLAR ───────────────────────────────

export interface Partner {
  id: ID
  name: string
  phone?: string
  /** Sistemin "sahibi" — kardeşiniz. Dashboard bakiyeleri bu kişiye göre gösterilir. */
  isPrimary: boolean
  color: string
}

export interface ProjectShare {
  partnerId: ID
  shareBps: Bps
}

// ─────────────────────────────── İNŞAAT ───────────────────────────────

export type ProjectStatus = 'planlama' | 'devam' | 'tamamlandi' | 'beklemede'

export type CostCategory = 'malzeme' | 'taseron' | 'resmi' | 'lojistik'

export interface Project {
  id: ID
  name: string
  location: string
  status: ProjectStatus
  startDate: ISODate
  plannedEndDate?: ISODate
  /** Tamamlanma yüzdesi 0-100 (fiziksel ilerleme) */
  progress: number
  unitCount?: number
  shares: ProjectShare[]
  /** Kategori bazlı öngörülen bütçe */
  budget: Record<CostCategory, Kurus>
  notes?: string
}

// ─────────────────────────────── GAYRİMENKUL ───────────────────────────────

export interface Property {
  id: ID
  name: string
  address: string
  /** Tapu bilgisi: ada / parsel / pafta / nitelik */
  deed: {
    ada?: string
    parsel?: string
    pafta?: string
    nitelik?: string
  }
  /** Mülk bir inşaat projesinden çıktıysa bağlantı */
  projectId?: ID
}

export interface Unit {
  id: ID
  propertyId: ID
  /** Daire / dükkan no: "A-3", "Dükkan 1" */
  label: string
  floor?: string
  grossM2?: number
  rooms?: string
}

export type IncreasePeriod = 'yillik' | 'alti_aylik'

export interface Tenant {
  id: ID
  name: string
  phone?: string
  email?: string
  tcknMasked?: string
}

export interface Lease {
  id: ID
  unitId: ID
  tenantId: ID
  startDate: ISODate
  endDate: ISODate
  /** Başlangıç aylık kira bedeli */
  monthlyRent: Kurus
  deposit: Kurus
  /** Ayın kaçında ödenir (1-28) */
  dueDay: number
  increasePeriod: IncreasePeriod
  /** Artış oranı (bps). TÜFE/12 aylık ort. veya sözleşmedeki oran. %35 = 3500 */
  increaseRateBps: Bps
  active: boolean
}

export interface RentPayment {
  id: ID
  leaseId: ID
  /** Hangi aya ait kira */
  month: MonthKey
  paidDate: ISODate
  amount: Kurus
  note?: string
}

export type RentStatus = 'odendi' | 'kismi' | 'gecikmede' | 'bekliyor' | 'yaklasan'

export interface RentScheduleCell {
  leaseId: ID
  month: MonthKey
  dueDate: ISODate
  expected: Kurus
  paid: Kurus
  status: RentStatus
  daysLate: number
}

// ─────────────────────────────── İŞLEMLER (LEDGER) ───────────────────────────────

/**
 * Tek bir işlem defteri (ledger) tüm hareketleri tutar:
 *  - gider:   masraf (inşaat veya mülk veya şahsi)
 *  - gelir:   gelir (daire satışı, kira dışı gelirler) — ortak ise hissedarlara dağıtılır
 *  - sermaye: ortağın ortak kasaya para koyması
 *  - mahsup:  ortaklar arası doğrudan ödeme (borç kapatma)
 * Kira tahsilatları `RentPayment` içinde ayrı tutulur.
 */
export type TransactionKind = 'gider' | 'gelir' | 'sermaye' | 'mahsup'

/** Gider türü — zorunlu seçim #1 */
export type ExpenseScope = 'ortak' | 'sahsi'

/** Ödemeyi yapan — zorunlu seçim #2 */
export type Payer = { kind: 'kasa' } | { kind: 'ortak'; partnerId: ID }

export type ExpenseCategory =
  | CostCategory
  | 'dask'
  | 'sigorta'
  | 'emlak_vergisi'
  | 'tadilat'
  | 'aidat'
  | 'diger'

export interface Transaction {
  id: ID
  kind: TransactionKind
  date: ISODate
  /** Fiş / fatura no */
  docNo?: string
  description: string
  amount: Kurus

  /** gider/gelir için */
  scope?: ExpenseScope
  category?: ExpenseCategory
  /** Tedarikçi / taşeron (hakediş için) */
  vendor?: string
  /** Hakediş no (taşeron ödemeleri) */
  progressPaymentNo?: number

  projectId?: ID
  propertyId?: ID

  /**
   * gider: parayı kim ödedi
   * gelir: parayı kim tahsil etti (kasaya mı girdi, bir ortağın cebine mi)
   * sermaye: kasaya parayı koyan ortak
   * mahsup: parayı veren ortak
   */
  payer: Payer
  /** mahsup: parayı alan ortak */
  receiverPartnerId?: ID
  /** şahsi gider kime ait (varsayılan: ödeyen) */
  ownerPartnerId?: ID

  createdAt: string
  /** Kaydı giren kullanıcı */
  createdBy?: ID
}

// ─────────────────────────────── MAHSUPLAŞMA ÇIKTILARI ───────────────────────────────

/** Mahsuplaşma motorunun ürettiği satır: bir işlemin bir ortağa etkisi */
export interface LedgerEntry {
  transactionId: ID
  projectId: ID
  partnerId: ID
  date: ISODate
  description: string
  /** Ortağın cebinden/katkısından çıkan (alacak yaratan) */
  credit: Kurus
  /** Ortağın hissesine düşen yük (borç yaratan) */
  debit: Kurus
}

export interface PartnerBalance {
  partnerId: ID
  /** Kendi cebinden ödediği + kasaya koyduğu + verdiği mahsup */
  paid: Kurus
  /** Hissesine düşen gider − hissesine düşen gelir + aldığı mahsup + cebine aldığı gelir */
  share: Kurus
  /** Kasadaki nakitten hissesine düşen pay */
  kasaShare: Kurus
  /** Net: + ise alacaklı, − ise borçlu */
  net: Kurus
}

export interface SettlementTransfer {
  fromPartnerId: ID
  toPartnerId: ID
  amount: Kurus
}

export interface ProjectSettlement {
  projectId: ID
  kasaBalance: Kurus
  balances: PartnerBalance[]
  transfers: SettlementTransfer[]
  /** Hisse toplamı 10000 değilse uyarı */
  shareError?: string
}

// ─────────────────────────────── KULLANICI & YETKİ ───────────────────────────────

/** Yetkilendirilebilen sayfalar */
export type PageKey =
  | 'dashboard'
  | 'gunluk'
  | 'insaatlar'
  | 'mahsuplasma'
  | 'kiracilar'
  | 'mulkler'
  | 'islemler'
  | 'ayarlar'

export type UserRole = 'yonetici' | 'eleman'

export interface AppUser {
  id: ID
  name: string
  /** Giriş adı (küçük harf) */
  username: string
  role: UserRole
  /** SHA-256(salt + ':' + şifre), hex */
  passwordHash: string
  salt: string
  /** Eleman için erişebileceği sayfalar (yönetici her yere erişir) */
  pages: PageKey[]
  /** Yeni kayıt ekleyebilir (gider, günlük, kira tahsilatı, kiracı) */
  canAdd: boolean
  /** Mevcut kayıtları düzenleyip silebilir */
  canEdit: boolean
  active: boolean
}

// ─────────────────────────────── ŞANTİYE GÜNLÜĞÜ ───────────────────────────────

export interface SiteLog {
  id: ID
  projectId: ID
  date: ISODate
  /** O gün ne oldu: "İnşaat başladı, temel kazısı yapıldı" */
  note: string
  /** Sahadaki işçi sayısı (opsiyonel) */
  workers?: number
  createdBy?: ID
  createdAt: string
}
