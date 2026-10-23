import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Printer, Wallet } from 'lucide-react'
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Select,
  Table, TBody, TD, TFoot, TH, THead, TR,
} from '@/components/ui'
import { EmptyState, Money, PageHeader, PartnerDot } from '@/components/shared'
import { useAppStore } from '@/store/useAppStore'
import { useUIStore } from '@/store/useUIStore'
import { useSettlement, useToday } from '@/hooks/useFinance'
import { useCan } from '@/store/useAuthStore'
import { projectLedger } from '@/lib/settlement'
import { formatDate } from '@/lib/dates'
import { formatTL } from '@/lib/money'
import { cn, IS_PREVIEW } from '@/lib/utils'
import type { PartnerBalance, SettlementTransfer } from '@/types'
import { Handshake } from 'lucide-react'

export function SettlementPage() {
  const { partners, projects, transactions } = useAppStore()
  const openTx = useUIStore((s) => s.openTxDialog)
  const can = useCan()
  const all = useSettlement()
  const { today } = useToday()
  const [params, setParams] = useSearchParams()
  const scope = params.get('proje') ?? 'tumu'
  const pMap = new Map(partners.map((p) => [p.id, p]))
  const project = projects.find((p) => p.id === scope)

  const view = project
    ? all.perProject.find((x) => x.projectId === project.id)!
    : { balances: all.totals, transfers: all.transfers, kasaBalance: all.kasaTotal, shareError: undefined }

  const balances: PartnerBalance[] = [...view.balances].sort((a, b) => b.net - a.net)
  const maxAbs = Math.max(1, ...balances.map((b) => Math.abs(b.net)))
  const primary = partners.find((p) => p.isPrimary)
  const [ledgerPartner, setLedgerPartner] = React.useState(primary?.id ?? partners[0]?.id ?? '')

  const ledger = React.useMemo(() => {
    const ps = project ? [project] : projects
    const all_ = ps.flatMap((p) => projectLedger(p, transactions))
    const rows = all_
      .filter((e) => e.partnerId === ledgerPartner)
      // Aynı işlemin alacak + borç satırlarını tek satırda birleştir
      .reduce<typeof all_>((acc, e) => {
        const last = acc[acc.length - 1]
        if (last && last.transactionId === e.transactionId) {
          last.credit += e.credit
          last.debit += e.debit
        } else acc.push({ ...e })
        return acc
      }, [])
      .sort((a, b) => a.date.localeCompare(b.date))
    const out: ((typeof rows)[number] & { running: number })[] = []
    let run = 0
    for (const r of rows) {
      run += r.credit - r.debit
      out.push({ ...r, running: run })
    }
    return out
  }, [project, projects, transactions, ledgerPartner])

  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? ''

  function recordTransfer(t: SettlementTransfer) {
    if (!project) return
    openTx({
      kind: 'mahsup',
      projectId: project.id,
      payer: { kind: 'ortak', partnerId: t.fromPartnerId },
      receiverPartnerId: t.toPartnerId,
      amount: t.amount,
      date: today,
      description: `Mahsup: ${pMap.get(t.fromPartnerId)?.name} → ${pMap.get(t.toPartnerId)?.name}`,
    })
  }

  function exportCSV() {
    const lines = [
      ['Ortak', 'Cebinden+Sermaye', 'Hissesine Düşen', 'Kasa Payı', 'Net'].join(';'),
      ...balances.map((b) =>
        [pMap.get(b.partnerId)?.name, b.paid / 100, b.share / 100, b.kasaShare / 100, b.net / 100].join(';'),
      ),
      '',
      ['Borçlu', 'Alacaklı', 'Tutar'].join(';'),
      ...view.transfers.map((t) => [pMap.get(t.fromPartnerId)?.name, pMap.get(t.toPartnerId)?.name, t.amount / 100].join(';')),
    ]
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mahsuplasma-${project?.name ?? 'tum-projeler'}-${today}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (projects.length === 0) {
    return <EmptyState icon={Handshake} title="Mahsuplaşma için önce bir proje ve ortaklar tanımlayın" />
  }

  return (
    <>
      <PageHeader
        title="Mahsuplaşma Raporu"
        description="Ortaklar arası cari hesap: kim ne ödedi, kim kimden ne kadar alacaklı"
        actions={
          <>
            <Select value={scope} onChange={(e) => setParams(e.target.value === 'tumu' ? {} : { proje: e.target.value })} className="w-60 print:hidden">
              <option value="tumu">Tüm projeler (birleşik)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {!IS_PREVIEW && (
              <>
            <Button variant="outline" onClick={exportCSV} className="print:hidden">
              <Download /> CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="print:hidden">
              <Printer /> Yazdır
            </Button>
              </>
            )}
          </>
        }
      />
      <p className="mb-4 hidden text-sm print:block">
        {project?.name ?? 'Tüm projeler'} · {formatDate(today)}
      </p>

      {view.shareError && (
        <p className="mb-4 flex items-center gap-2 rounded-md bg-negative-bg px-3 py-2 text-sm text-negative">
          <AlertTriangle className="size-4" /> {view.shareError}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Kim kime ödemeli */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Net mahsuplaşma — kim kime ödemeli?</CardTitle>
            <CardDescription>En az sayıda ödemeyle tüm bakiyeleri sıfırlayan plan</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2">
            {view.transfers.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md bg-positive-bg px-3 py-3 text-sm text-positive">
                <CheckCircle2 className="size-4" /> Tüm ortaklar dengede, ödeme gerekmiyor.
              </div>
            ) : (
              view.transfers.map((t) => (
                <div key={t.fromPartnerId + t.toPartnerId} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                      <PartnerDot partner={pMap.get(t.fromPartnerId)} className="font-medium" />
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      <PartnerDot partner={pMap.get(t.toPartnerId)} className="font-medium" />
                    </div>
                    <Money value={t.amount} className="text-base font-semibold" />
                  </div>
                  {project && can.add && (
                    <Button variant="ghost" size="sm" className="mt-1 -ml-2 text-primary print:hidden" onClick={() => recordTransfer(t)}>
                      Ödendi olarak kaydet
                    </Button>
                  )}
                </div>
              ))
            )}
            {!project && view.transfers.length > 0 && (
              <p className="text-xs text-muted-foreground">Ödemeyi kaydetmek için yukarıdan ilgili projeyi seçin.</p>
            )}
            <div className={cn('mt-2 flex items-center justify-between rounded-md px-3 py-2 text-sm', view.kasaBalance < 0 ? 'bg-negative-bg' : 'bg-muted')}>
              <span className="inline-flex items-center gap-2">
                <Wallet className="size-4" /> Ortak kasada kalan
              </span>
              <Money value={view.kasaBalance} signed={view.kasaBalance < 0} className="font-medium" />
            </div>
            {view.kasaBalance < 0 && (
              <p className="text-xs text-negative">
                Kasa eksiye düşmüş: ortaklar hisseleri oranında toplam {formatTL(-view.kasaBalance)} sermaye koymalı.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Net bakiye görselleştirme */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>Ortak bazında net pozisyon</CardTitle>
            <CardDescription>Sağ: alacaklı · Sol: borçlu (kasadaki nakitten payı düşülmüş)</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {balances.map((b) => {
              const w = (Math.abs(b.net) / maxAbs) * 50
              return (
                <div key={b.partnerId} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
                  <PartnerDot partner={pMap.get(b.partnerId)} />
                  <div className="relative h-6 rounded bg-muted">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                    <div
                      className={cn('absolute inset-y-1 rounded-sm', b.net >= 0 ? 'bg-positive' : 'bg-negative')}
                      style={b.net >= 0 ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
                    />
                  </div>
                  <Money value={b.net} signed className="w-28 text-right font-medium" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Bakiye tablosu */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Bakiye detayı</CardTitle>
          <CardDescription>
            Net = (cebinden ödediği + kasaya koyduğu + verdiği mahsup) − (hissesine düşen gider + cebine aldığı gelir + aldığı mahsup) − kasadaki payı
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Ortak</TH>
                <TH className="text-right">Ödediği / Koyduğu</TH>
                <TH className="text-right">Hissesine düşen</TH>
                <TH className="text-right">Kasadaki payı</TH>
                <TH className="text-right">Net bakiye</TH>
                <TH className="text-right">Durum</TH>
              </TR>
            </THead>
            <TBody>
              {balances.map((b) => (
                <TR key={b.partnerId}>
                  <TD><PartnerDot partner={pMap.get(b.partnerId)} /></TD>
                  <TD className="text-right"><Money value={b.paid} /></TD>
                  <TD className="text-right"><Money value={b.share} /></TD>
                  <TD className="text-right"><Money value={b.kasaShare} /></TD>
                  <TD className="text-right font-semibold"><Money value={b.net} signed /></TD>
                  <TD className="text-right">
                    {b.net > 0 ? <Badge variant="positive">Alacaklı</Badge> : b.net < 0 ? <Badge variant="negative">Borçlu</Badge> : <Badge>Dengede</Badge>}
                  </TD>
                </TR>
              ))}
            </TBody>
            <TFoot>
              <TR>
                <TD>Toplam</TD>
                <TD className="text-right"><Money value={balances.reduce((a, b) => a + b.paid, 0)} /></TD>
                <TD className="text-right"><Money value={balances.reduce((a, b) => a + b.share, 0)} /></TD>
                <TD className="text-right"><Money value={balances.reduce((a, b) => a + b.kasaShare, 0)} /></TD>
                <TD className="text-right"><Money value={balances.reduce((a, b) => a + b.net, 0)} signed /></TD>
                <TD />
              </TR>
            </TFoot>
          </Table>
        </CardContent>
      </Card>

      {/* Cari hesap defteri */}
      <Card className="mt-4 print:break-before-page">
        <CardHeader className="sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Cari hesap defteri</CardTitle>
            <CardDescription>Seçili ortağın her işlemdeki alacak/borç hareketi ve yürüyen bakiye (kasa payı hariç)</CardDescription>
          </div>
          <Select value={ledgerPartner} onChange={(e) => setLedgerPartner(e.target.value)} className="sm:w-56">
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Bu ortak için hareket yok.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tarih</TH>
                  <TH>Açıklama</TH>
                  {!project && <TH>Proje</TH>}
                  <TH className="text-right">Alacak (+)</TH>
                  <TH className="text-right">Borç (−)</TH>
                  <TH className="text-right">Bakiye</TH>
                </TR>
              </THead>
              <TBody>
                {ledger.map((e, i) => (
                  <TR key={e.transactionId + i}>
                    <TD className="num text-xs">{formatDate(e.date)}</TD>
                    <TD className="text-sm">{e.description}</TD>
                    {!project && <TD className="text-xs text-muted-foreground">{projName(e.projectId)}</TD>}
                    <TD className="text-right">{e.credit ? <Money value={e.credit} className="text-positive" /> : ''}</TD>
                    <TD className="text-right">{e.debit ? <Money value={e.debit} className="text-negative" /> : ''}</TD>
                    <TD className="text-right font-medium"><Money value={e.running} signed /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
