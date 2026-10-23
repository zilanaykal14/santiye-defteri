/**
 * Demo verisi. Tarihler BUGÜNE GÖRE göreli üretilir; demo her zaman "güncel" görünür.
 * Tutarlar kuruştur: tl(100_000) = 100.000 TL.
 */
import { addMonths, dueDateOf, monthOf, todayISO } from '@/lib/dates'
import { expectedRent } from '@/lib/rent'
import type {
  Lease,
  AppUser,
  Partner,
  Project,
  SiteLog,
  Property,
  RentPayment,
  Tenant,
  Transaction,
  Unit,
} from '@/types'

const tl = (n: number) => Math.round(n * 100)

export interface DataSnapshot {
  partners: Partner[]
  projects: Project[]
  properties: Property[]
  units: Unit[]
  tenants: Tenant[]
  leases: Lease[]
  rentPayments: RentPayment[]
  transactions: Transaction[]
  users: AppUser[]
  siteLogs: SiteLog[]
}

export function buildSeed(now = new Date()): DataSnapshot {
  const today = todayISO(now)
  const cur = monthOf(today)
  /** offset ay önce/sonra, ayın `day`. günü */
  const d = (offset: number, day: number) => dueDateOf(addMonths(cur, offset), day)

  const partners: Partner[] = [
    { id: 'p-kardes', name: 'Ahmet (Kardeşim)', phone: '0532 000 00 01', isPrimary: true, color: 'var(--chart-1)' },
    { id: 'p-mehmet', name: 'Mehmet Yılmaz', phone: '0533 000 00 02', isPrimary: false, color: 'var(--chart-2)' },
    { id: 'p-ali', name: 'Muhammed Demir', phone: '0535 000 00 03', isPrimary: false, color: 'var(--chart-3)' },
    { id: 'p-serkan', name: 'Serkan Kaya', phone: '0542 000 00 04', isPrimary: false, color: 'var(--chart-4)' },
  ]

  const projects: Project[] = [
    {
      id: 'pr-baglar',
      name: 'Bağlar 12 Daire Projesi',
      location: 'Bağlar Mah., Merkezefendi',
      status: 'devam',
      startDate: d(-11, 1),
      plannedEndDate: d(7, 30),
      progress: 55,
      unitCount: 12,
      shares: [
        { partnerId: 'p-kardes', shareBps: 5000 },
        { partnerId: 'p-mehmet', shareBps: 3000 },
        { partnerId: 'p-ali', shareBps: 2000 },
      ],
      budget: { malzeme: tl(18_000_000), taseron: tl(9_500_000), resmi: tl(1_400_000), lojistik: tl(1_100_000) },
    },
    {
      id: 'pr-villa',
      name: 'Lüks Villa İnşaatı',
      location: 'Kınıklı, Pamukkale',
      status: 'devam',
      startDate: d(-7, 15),
      plannedEndDate: d(9, 30),
      progress: 30,
      unitCount: 1,
      shares: [
        { partnerId: 'p-kardes', shareBps: 6000 },
        { partnerId: 'p-serkan', shareBps: 4000 },
      ],
      budget: { malzeme: tl(6_500_000), taseron: tl(3_800_000), resmi: tl(650_000), lojistik: tl(450_000) },
    },
    {
      id: 'pr-camlik',
      name: 'Çamlık 4 Daire (Teslim)',
      location: 'Çamlık Mah.',
      status: 'tamamlandi',
      startDate: d(-30, 1),
      plannedEndDate: d(-14, 30),
      progress: 100,
      unitCount: 4,
      shares: [
        { partnerId: 'p-kardes', shareBps: 5000 },
        { partnerId: 'p-mehmet', shareBps: 5000 },
      ],
      budget: { malzeme: tl(4_000_000), taseron: tl(2_200_000), resmi: tl(300_000), lojistik: tl(250_000) },
    },
  ]

  let seq = 0
  const tx = (t: Omit<Transaction, 'id' | 'createdAt'>): Transaction => ({
    ...t,
    id: `t-${String(++seq).padStart(4, '0')}`,
    createdAt: `${t.date}T09:${String(seq % 60).padStart(2, '0')}:00.000Z`,
  })
  const kasa = { kind: 'kasa' } as const
  const by = (partnerId: string) => ({ kind: 'ortak', partnerId }) as const

  const transactions: Transaction[] = [
    // ── Bağlar: sermaye ──
    tx({ kind: 'sermaye', date: d(-11, 3), description: 'Başlangıç sermayesi', amount: tl(2_500_000), payer: by('p-kardes'), projectId: 'pr-baglar' }),
    tx({ kind: 'sermaye', date: d(-11, 3), description: 'Başlangıç sermayesi', amount: tl(1_500_000), payer: by('p-mehmet'), projectId: 'pr-baglar' }),
    tx({ kind: 'sermaye', date: d(-11, 5), description: 'Başlangıç sermayesi', amount: tl(1_000_000), payer: by('p-ali'), projectId: 'pr-baglar' }),
    tx({ kind: 'sermaye', date: d(-4, 2), description: '2. sermaye çağrısı', amount: tl(1_500_000), payer: by('p-kardes'), projectId: 'pr-baglar' }),
    tx({ kind: 'sermaye', date: d(-4, 6), description: '2. sermaye çağrısı', amount: tl(900_000), payer: by('p-mehmet'), projectId: 'pr-baglar' }),
    tx({ kind: 'sermaye', date: d(-1, 3), description: '3. sermaye çağrısı', amount: tl(2_750_000), payer: by('p-kardes'), projectId: 'pr-baglar' }),
    tx({ kind: 'sermaye', date: d(-1, 4), description: '3. sermaye çağrısı', amount: tl(1_650_000), payer: by('p-mehmet'), projectId: 'pr-baglar' }),
    // Muhammed 2. ve 3. çağrılara henüz katılmadı → borçlu görünür
    // ── Bağlar: resmi ──
    tx({ kind: 'gider', scope: 'ortak', category: 'resmi', date: d(-11, 8), docNo: 'BLD-2291', description: 'Yapı ruhsatı ve belediye harçları', amount: tl(640_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Merkezefendi Belediyesi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'resmi', date: d(-11, 12), docNo: 'MM-118', description: 'Mimari + statik proje çizimi', amount: tl(385_000), payer: by('p-kardes'), projectId: 'pr-baglar', vendor: 'Arkon Mimarlık' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'resmi', date: d(-9, 4), docNo: 'YDK-07', description: 'Yapı denetim 1. taksit', amount: tl(210_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Ege Yapı Denetim' }),
    // ── Bağlar: malzeme ──
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-10, 10), docNo: 'FTR-A4410', description: 'Hazır beton C30 — temel (420 m³)', amount: tl(1_386_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Denizli Beton' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-10, 14), docNo: 'FTR-D0081', description: 'İnşaat demiri Ø12-Ø16 (62 ton)', amount: tl(1_550_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Kardemir Bayi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-8, 9), docNo: 'FTR-D0144', description: 'İnşaat demiri ek sipariş', amount: tl(100_000), payer: by('p-kardes'), projectId: 'pr-baglar', vendor: 'Kardemir Bayi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-7, 20), docNo: 'FTR-A4677', description: 'Hazır beton — 1-3. kat döşeme', amount: tl(2_150_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Denizli Beton' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-5, 11), docNo: 'FTR-D0219', description: 'İnşaat demiri — üst katlar (48 ton)', amount: tl(1_296_000), payer: by('p-mehmet'), projectId: 'pr-baglar', vendor: 'Kardemir Bayi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-4, 18), docNo: 'FTR-A4902', description: 'Hazır beton — 4-5. kat + çatı', amount: tl(1_780_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Denizli Beton' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-2, 7), docNo: 'FTR-T3301', description: 'Bims blok / tuğla (38.000 adet)', amount: tl(912_000), payer: by('p-kardes'), projectId: 'pr-baglar', vendor: 'Akyol Yapı Market' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-1, 16), docNo: 'FTR-S1120', description: 'Sıva harcı ve çimento', amount: tl(468_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Akyol Yapı Market' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(0, 6), docNo: 'FTR-E0907', description: 'Elektrik tesisat malzemesi', amount: tl(334_000), payer: by('p-ali'), projectId: 'pr-baglar', vendor: 'Işık Elektrik' }),
    // ── Bağlar: taşeron hakedişleri ──
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-9, 25), docNo: 'HK-K1', description: 'Kalıp-demir işçiliği 1. hakediş', amount: tl(720_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Usta Kalıp (Hüseyin K.)', progressPaymentNo: 1 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-7, 25), docNo: 'HK-K2', description: 'Kalıp-demir işçiliği 2. hakediş', amount: tl(860_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Usta Kalıp (Hüseyin K.)', progressPaymentNo: 2 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-5, 25), docNo: 'HK-K3', description: 'Kalıp-demir işçiliği 3. hakediş', amount: tl(910_000), payer: by('p-kardes'), projectId: 'pr-baglar', vendor: 'Usta Kalıp (Hüseyin K.)', progressPaymentNo: 3 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-3, 28), docNo: 'HK-K4', description: 'Kalıp-demir işçiliği 4. (son) hakediş', amount: tl(640_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Usta Kalıp (Hüseyin K.)', progressPaymentNo: 4 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-1, 26), docNo: 'HK-D1', description: 'Duvarcı 1. hakediş', amount: tl(420_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Kaya Duvar Ekibi', progressPaymentNo: 1 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(0, 10), docNo: 'HK-S1', description: 'Sıvacı 1. hakediş', amount: tl(285_000), payer: by('p-kardes'), projectId: 'pr-baglar', vendor: 'Öz Sıva', progressPaymentNo: 1 }),
    // ── Bağlar: lojistik ──
    tx({ kind: 'gider', scope: 'ortak', category: 'lojistik', date: d(-10, 3), docNo: 'VN-55', description: 'Kule vinç kirası (3 ay)', amount: tl(270_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Ege Vinç' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'lojistik', date: d(-6, 3), docNo: 'VN-81', description: 'Kule vinç kirası (3 ay)', amount: tl(285_000), payer: kasa, projectId: 'pr-baglar', vendor: 'Ege Vinç' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'lojistik', date: d(-2, 20), docNo: 'GV-12', description: 'Şantiye güvenlik + konteyner', amount: tl(96_000), payer: by('p-mehmet'), projectId: 'pr-baglar', vendor: 'Kale Güvenlik' }),
    // Şahsi gider ama ortak kasadan ödenmiş → Ahmet kasaya borçlanır
    tx({ kind: 'gider', scope: 'sahsi', category: 'diger', date: d(-3, 9), docNo: 'SV-01', description: 'Şahsi araç servisi (kasadan ödendi)', amount: tl(42_000), payer: kasa, ownerPartnerId: 'p-kardes', projectId: 'pr-baglar' }),
    // Daire ön satış — kapora Ahmet'in hesabına yattı
    tx({ kind: 'gelir', scope: 'ortak', category: 'diger', date: d(-1, 12), docNo: 'SÖZ-3', description: 'B-3 daire ön satış kaporası', amount: tl(750_000), payer: by('p-kardes'), projectId: 'pr-baglar' }),
    // Ali, Mehmet'e borcunun bir kısmını ödedi
    tx({ kind: 'mahsup', date: d(-1, 28), description: 'Muhammed → Mehmet kısmi mahsup', amount: tl(150_000), payer: by('p-ali'), receiverPartnerId: 'p-mehmet', projectId: 'pr-baglar' }),

    // ── Villa ──
    tx({ kind: 'sermaye', date: d(-7, 16), description: 'Başlangıç sermayesi', amount: tl(1_800_000), payer: by('p-kardes'), projectId: 'pr-villa' }),
    tx({ kind: 'sermaye', date: d(-7, 18), description: 'Başlangıç sermayesi', amount: tl(1_200_000), payer: by('p-serkan'), projectId: 'pr-villa' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'resmi', date: d(-7, 20), docNo: 'BLD-3302', description: 'Ruhsat + harçlar', amount: tl(310_000), payer: kasa, projectId: 'pr-villa', vendor: 'Pamukkale Belediyesi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'resmi', date: d(-6, 2), docNo: 'MM-140', description: 'Mimari proje + 3D', amount: tl(240_000), payer: by('p-serkan'), projectId: 'pr-villa', vendor: 'Arkon Mimarlık' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-5, 14), docNo: 'FTR-A5011', description: 'Hazır beton — temel + bodrum', amount: tl(980_000), payer: kasa, projectId: 'pr-villa', vendor: 'Denizli Beton' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-5, 10), docNo: 'FTR-D0233', description: 'İnşaat demiri (24 ton)', amount: tl(650_000), payer: by('p-kardes'), projectId: 'pr-villa', vendor: 'Kardemir Bayi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-4, 24), docNo: 'HK-V1', description: 'Kaba inşaat ekibi 1. hakediş', amount: tl(560_000), payer: kasa, projectId: 'pr-villa', vendor: 'Usta Kalıp (Hüseyin K.)', progressPaymentNo: 1 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'taseron', date: d(-2, 24), docNo: 'HK-V2', description: 'Kaba inşaat ekibi 2. hakediş', amount: tl(610_000), payer: kasa, projectId: 'pr-villa', vendor: 'Usta Kalıp (Hüseyin K.)', progressPaymentNo: 2 }),
    tx({ kind: 'gider', scope: 'ortak', category: 'malzeme', date: d(-1, 5), docNo: 'FTR-Y220', description: 'Yalıtım ve çatı malzemesi', amount: tl(520_000), payer: by('p-serkan'), projectId: 'pr-villa', vendor: 'İzocam Bayi' }),
    tx({ kind: 'gider', scope: 'ortak', category: 'lojistik', date: d(0, 4), docNo: 'NK-09', description: 'Nakliye ve iş makinesi', amount: tl(115_000), payer: kasa, projectId: 'pr-villa', vendor: 'Çelik Nakliyat' }),

    // ── Mülk giderleri (Ahmet'in kira portföyü) ──
    tx({ kind: 'gider', scope: 'sahsi', category: 'dask', date: d(-8, 12), docNo: 'DASK-4471', description: 'DASK poliçeleri (4 daire)', amount: tl(9_600), payer: by('p-kardes'), propertyId: 'prop-camlik' }),
    tx({ kind: 'gider', scope: 'sahsi', category: 'sigorta', date: d(-8, 12), docNo: 'KS-901', description: 'Konut sigortası (4 daire)', amount: tl(14_800), payer: by('p-kardes'), propertyId: 'prop-camlik' }),
    tx({ kind: 'gider', scope: 'sahsi', category: 'emlak_vergisi', date: d(-5, 28), docNo: 'EV-2026/1', description: 'Emlak vergisi 1. taksit', amount: tl(11_200), payer: by('p-kardes'), propertyId: 'prop-camlik' }),
    tx({ kind: 'gider', scope: 'sahsi', category: 'emlak_vergisi', date: d(-5, 28), docNo: 'EV-2026/1D', description: 'Emlak vergisi 1. taksit — dükkan', amount: tl(6_400), payer: by('p-kardes'), propertyId: 'prop-dukkan' }),
    tx({ kind: 'gider', scope: 'sahsi', category: 'tadilat', date: d(-3, 15), docNo: 'TD-33', description: 'A-2 kombi değişimi', amount: tl(38_500), payer: by('p-kardes'), propertyId: 'prop-camlik', vendor: 'Ege Isı' }),
    tx({ kind: 'gider', scope: 'sahsi', category: 'tadilat', date: d(-1, 8), docNo: 'TD-41', description: 'Dükkan vitrin camı tamiri', amount: tl(17_000), payer: by('p-kardes'), propertyId: 'prop-dukkan' }),
    tx({ kind: 'gider', scope: 'sahsi', category: 'aidat', date: d(0, 2), description: 'Boş daire (A-4) aidatı', amount: tl(1_250), payer: by('p-kardes'), propertyId: 'prop-camlik' }),
  ]

  const properties: Property[] = [
    { id: 'prop-camlik', name: 'Çamlık Apartmanı', address: 'Çamlık Mah. 2041 Sk. No:7, Merkezefendi', deed: { ada: '1284', parsel: '15', pafta: '21L-IV', nitelik: 'Kargir apartman' }, projectId: 'pr-camlik' },
    { id: 'prop-dukkan', name: 'Saraylar Dükkan', address: 'Saraylar Mah. İstiklal Cd. No:44/B', deed: { ada: '412', parsel: '9', nitelik: 'Dükkan' } },
  ]
  const units: Unit[] = [
    { id: 'u-a1', propertyId: 'prop-camlik', label: 'A-1', floor: 'Zemin', grossM2: 115, rooms: '3+1' },
    { id: 'u-a2', propertyId: 'prop-camlik', label: 'A-2', floor: '1', grossM2: 115, rooms: '3+1' },
    { id: 'u-a3', propertyId: 'prop-camlik', label: 'A-3', floor: '2', grossM2: 130, rooms: '3+1' },
    { id: 'u-a4', propertyId: 'prop-camlik', label: 'A-4', floor: '3', grossM2: 95, rooms: '2+1' },
    { id: 'u-d1', propertyId: 'prop-dukkan', label: 'Dükkan', floor: 'Zemin', grossM2: 80 },
  ]
  const tenants: Tenant[] = [
    { id: 'tn-1', name: 'Zeynep Arslan', phone: '0530 111 22 33', email: 'zeynep@example.com' },
    { id: 'tn-2', name: 'Murat Şahin', phone: '0536 222 33 44' },
    { id: 'tn-3', name: 'Elif & Can Öztürk', phone: '0541 333 44 55' },
    { id: 'tn-4', name: 'Doğan Optik Ltd.', phone: '0258 444 55 66', email: 'muhasebe@doganoptik.example' },
  ]
  const leases: Lease[] = [
    { id: 'l-1', unitId: 'u-a1', tenantId: 'tn-1', startDate: d(-14, 1), endDate: d(10, 28), monthlyRent: tl(15_000), deposit: tl(30_000), dueDay: 5, increasePeriod: 'yillik', increaseRateBps: 3300, active: true },
    { id: 'l-2', unitId: 'u-a2', tenantId: 'tn-2', startDate: d(-9, 1), endDate: d(1, 28), monthlyRent: tl(18_000), deposit: tl(36_000), dueDay: 25, increasePeriod: 'yillik', increaseRateBps: 3300, active: true },
    { id: 'l-3', unitId: 'u-a3', tenantId: 'tn-3', startDate: d(-20, 1), endDate: d(4, 28), monthlyRent: tl(14_000), deposit: tl(28_000), dueDay: 10, increasePeriod: 'yillik', increaseRateBps: 3500, active: true },
    { id: 'l-4', unitId: 'u-d1', tenantId: 'tn-4', startDate: d(-16, 1), endDate: d(20, 28), monthlyRent: tl(30_000), deposit: tl(90_000), dueDay: 1, increasePeriod: 'alti_aylik', increaseRateBps: 1500, active: true },
  ]

  // Kira ödemelerini üret: geçmiş aylar ödenmiş, birkaç bilinçli istisna
  const rentPayments: RentPayment[] = []
  const exceptions: Record<string, 'skip' | 'half'> = {
    [`l-3|${addMonths(cur, -1)}`]: 'half', // geçen ay kısmi
    [`l-3|${cur}`]: 'skip', // bu ay gecikmede
    [`l-4|${cur}`]: 'skip', // dükkan bu ay gecikmede
    [`l-2|${cur}`]: 'skip', // vadesi henüz gelmedi/yaklaşıyor
  }
  let pseq = 0
  for (const lease of leases) {
    for (let off = -36; off <= 0; off++) {
      const m = addMonths(cur, off)
      if (m < monthOf(lease.startDate) || m > monthOf(lease.endDate)) continue
      const due = dueDateOf(m, lease.dueDay)
      if (due > today) continue
      const ex = exceptions[`${lease.id}|${m}`]
      if (ex === 'skip') continue
      const full = expectedRent(lease, m)
      rentPayments.push({
        id: `rp-${++pseq}`,
        leaseId: lease.id,
        month: m,
        paidDate: due,
        amount: ex === 'half' ? Math.round(full / 200) * 100 : full,
        note: ex === 'half' ? 'Kalanı sonra ödeyecek' : undefined,
      })
    }
  }

  // ── Şantiye günlüğü (Bağlar) ──
  const logNotes: [number, number, string, number?][] = [
    [-11, 1, 'İnşaat başladı. Yer teslimi yapıldı, şantiye konteyneri kuruldu.', 4],
    [-11, 3, 'Ortaklar başlangıç sermayesini kasaya koydu. Temel kazısına başlandı.', 6],
    [-11, 8, 'Yapı ruhsatı alındı, belediye harçları ödendi.', 6],
    [-10, 10, 'Temel betonu döküldü (420 m³). Hava açık, döküm sorunsuz.', 14],
    [-10, 14, 'Temel ve perde demirleri sahaya geldi.', 10],
    [-7, 20, '1-3. kat döşemeleri tamamlandı.', 18],
    [-4, 18, 'Çatı katı betonu döküldü — kaba inşaat bitti.', 16],
    [-2, 7, 'Duvar örülmeye başlandı, tuğlalar geldi.', 12],
    [0, 6, 'Elektrik tesisatı malzemesi geldi, Muhammed ödedi.', 9],
    [0, 10, 'Sıva başladı. Sıvacıya 1. hakediş ödendi.', 11],
  ]
  const siteLogs: SiteLog[] = logNotes.map(([off, day, note, workers], i) => ({
    id: `log-${i + 1}`,
    projectId: 'pr-baglar',
    date: d(off, day),
    note,
    workers,
    createdBy: i % 3 === 0 ? 'u-admin' : 'u-sef',
    createdAt: `${d(off, day)}T18:00:00.000Z`,
  }))
  siteLogs.push({ id: 'log-v1', projectId: 'pr-villa', date: d(-7, 16), note: 'Villa inşaatı başladı, hafriyat yapıldı.', workers: 5, createdBy: 'u-admin', createdAt: `${d(-7, 16)}T18:00:00.000Z` })

  return { partners, projects, properties, units, tenants, leases, rentPayments, transactions, users: SEED_USERS, siteLogs }
}

/**
 * Demo kullanıcıları — İLK GİRİŞTEN SONRA ŞİFRELERİ DEĞİŞTİRİN.
 *   yonetici / 1234   (her yere erişir)
 *   santiye  / 1111   (yalnızca Şantiye Günlüğü + İnşaatlar, ekleyebilir, silemez)
 *   muhasebe / 2222   (kira ve işlemler)
 */
export const SEED_USERS: AppUser[] = [
  {
    id: 'u-admin', name: 'Ahmet (Yönetici)', username: 'yonetici', role: 'yonetici',
    salt: 's-adm9', passwordHash: 'da976b1004a8081a7a29164c5028e27dfc699c5236028cb6f06d89239779bcfc',
    pages: [], canAdd: true, canEdit: true, active: true,
  },
  {
    id: 'u-sef', name: 'Hasan Usta (Şantiye Şefi)', username: 'santiye', role: 'eleman',
    salt: 's-sef4', passwordHash: 'a710366ccb6dc6eb3ba47860bab9d64c2a3c6b80b55d7b0f523599047093151f',
    pages: ['gunluk', 'insaatlar'], canAdd: true, canEdit: false, active: true,
  },
  {
    id: 'u-muh', name: 'Zeynep (Muhasebe)', username: 'muhasebe', role: 'eleman',
    salt: 's-muh7', passwordHash: 'b27ebd37b4a24ebd11e1e97bdd735f90757a9917434a98a0fa64c8e91fb444cc',
    pages: ['dashboard', 'kiracilar', 'mulkler', 'islemler'], canAdd: true, canEdit: true, active: true,
  },
]

export const EMPTY_SNAPSHOT: DataSnapshot = {
  partners: [],
  projects: [],
  properties: [],
  units: [],
  tenants: [],
  leases: [],
  rentPayments: [],
  transactions: [],
  users: [],
  siteLogs: [],
}
