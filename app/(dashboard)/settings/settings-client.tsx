'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/store/auth-store'
import { exchangeRateValue, formatRate } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Building2, DollarSign, FileText, Bell } from 'lucide-react'

export function SettingsClient({ org, settings }: { org: any; settings: any }) {
  const { setAuth, user, organization, branch } = useAuthStore()

  // Org settings
  const [orgName, setOrgName] = useState(org.name ?? '')
  const [exchangeRate, setExchangeRate] = useState(
    org.exchange_rate ? (org.exchange_rate / 1000).toFixed(0) : '90000'
  )
  const [vatEnabled, setVatEnabled] = useState(org.vat_enabled ?? false)
  const [vatRate, setVatRate] = useState((org.vat_rate ?? 11).toString())
  const [defaultCurrency, setDefaultCurrency] = useState(org.default_currency ?? 'USD')
  const [savingOrg, setSavingOrg] = useState(false)

  // Display settings
  const [currencyDisplay, setCurrencyDisplay] = useState(settings.currency_display ?? 'both')
  const [receiptHeader, setReceiptHeader] = useState(settings.receipt_header ?? '')
  const [receiptFooter, setReceiptFooter] = useState(settings.receipt_footer ?? 'Thank you!')
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoice_prefix ?? 'INV')
  const [lowStockDays, setLowStockDays] = useState((settings.low_stock_alert_days ?? 3).toString())
  const [expiryDays, setExpiryDays] = useState((settings.expiry_alert_days ?? 14).toString())
  const [savingDisplay, setSavingDisplay] = useState(false)

  const handleSaveOrg = async () => {
    const rate = parseInt(exchangeRate)
    if (isNaN(rate) || rate <= 0) { toast.error('Enter a valid exchange rate'); return }
    setSavingOrg(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgName.trim(),
          exchange_rate: rate * 1000,
          vat_enabled: vatEnabled,
          vat_rate: parseFloat(vatRate) || 11,
          default_currency: defaultCurrency,
        })
        .eq('id', org.id)
      if (error) throw error

      // Update zustand so sidebar exchange rate refreshes
      if (organization && user && branch) {
        setAuth({
          user,
          organization: { ...organization, exchange_rate: rate * 1000, vat_enabled: vatEnabled, vat_rate: parseFloat(vatRate), default_currency: defaultCurrency, name: orgName.trim() },
          branch,
          settings: settings,
        })
      }
      toast.success('Organisation settings saved')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally {
      setSavingOrg(false)
    }
  }

  const handleSaveDisplay = async () => {
    setSavingDisplay(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('settings')
        .update({
          currency_display: currencyDisplay,
          receipt_header: receiptHeader.trim() || null,
          receipt_footer: receiptFooter.trim() || 'Thank you!',
          invoice_prefix: invoicePrefix.trim() || 'INV',
          low_stock_alert_days: parseInt(lowStockDays) || 3,
          expiry_alert_days: parseInt(expiryDays) || 14,
        })
        .eq('organization_id', org.id)
      if (error) throw error
      toast.success('Display settings saved')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally {
      setSavingDisplay(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your organisation and POS preferences</p>
      </div>

      <Tabs defaultValue="organisation">
        <TabsList>
          <TabsTrigger value="organisation"><Building2 className="h-4 w-4 mr-1.5" />Organisation</TabsTrigger>
          <TabsTrigger value="currency"><DollarSign className="h-4 w-4 mr-1.5" />Currency & VAT</TabsTrigger>
          <TabsTrigger value="receipts"><FileText className="h-4 w-4 mr-1.5" />Receipts</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="h-4 w-4 mr-1.5" />Alerts</TabsTrigger>
        </TabsList>

        {/* Organisation */}
        <TabsContent value="organisation">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Business Name</Label>
              <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Your business name" />
            </div>
            <div className="space-y-1.5">
              <Label>Subscription Plan</Label>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#1B2A4A]/10 text-[#1B2A4A] text-sm font-medium capitalize">
                  {org.subscription_plan ?? 'starter'}
                </span>
                <span className="text-xs text-gray-400">Contact support to upgrade</span>
              </div>
            </div>
            <Separator />
            <Button onClick={handleSaveOrg} disabled={savingOrg} className="bg-[#1B2A4A] text-white">
              {savingOrg && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Currency & VAT */}
        <TabsContent value="currency">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>USD → LBP Exchange Rate</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">$1 =</span>
                <div className="relative flex-1 max-w-xs">
                  <Input
                    type="number"
                    min={1}
                    value={exchangeRate}
                    onChange={e => setExchangeRate(e.target.value)}
                    placeholder="90000"
                  />
                </div>
                <span className="text-sm text-gray-500">LL</span>
              </div>
              <p className="text-xs text-gray-400">
                Current stored rate: {org.exchange_rate ? formatRate(org.exchange_rate) : '—'} LL/USD.
                This rate is snapshotted on every sale.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Default Display Currency</Label>
              <Select value={defaultCurrency} onValueChange={v => setDefaultCurrency(v ?? 'USD')}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="LBP">LBP (LL)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Currency Display on POS</Label>
              <Select value={currencyDisplay} onValueChange={v => setCurrencyDisplay(v ?? 'both')}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usd">USD only</SelectItem>
                  <SelectItem value="lbp">LBP only</SelectItem>
                  <SelectItem value="both">Both USD and LBP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Enable VAT</Label>
                <p className="text-xs text-gray-400 mt-0.5">Applies VAT to all sales at checkout</p>
              </div>
              <Switch checked={vatEnabled} onCheckedChange={setVatEnabled} />
            </div>

            {vatEnabled && (
              <div className="space-y-1.5">
                <Label>VAT Rate (%)</Label>
                <div className="flex items-center gap-2 max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={vatRate}
                    onChange={e => setVatRate(e.target.value)}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-400">Lebanon standard VAT is 11%</p>
              </div>
            )}

            <Separator />
            <Button onClick={() => { handleSaveOrg(); handleSaveDisplay() }} disabled={savingOrg || savingDisplay} className="bg-[#1B2A4A] text-white">
              {(savingOrg || savingDisplay) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Receipts */}
        <TabsContent value="receipts">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Receipt Header</Label>
              <Input
                value={receiptHeader}
                onChange={e => setReceiptHeader(e.target.value)}
                placeholder="e.g. Thank you for visiting us!"
              />
              <p className="text-xs text-gray-400">Shown at the top of every printed receipt</p>
            </div>

            <div className="space-y-1.5">
              <Label>Receipt Footer</Label>
              <Input
                value={receiptFooter}
                onChange={e => setReceiptFooter(e.target.value)}
                placeholder="Thank you!"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Invoice / PO Prefix</Label>
              <Input
                value={invoicePrefix}
                onChange={e => setInvoicePrefix(e.target.value)}
                placeholder="INV"
                className="max-w-[120px]"
              />
              <p className="text-xs text-gray-400">Prefix for invoice numbers (e.g. INV-2024-001)</p>
            </div>

            <Separator />
            <Button onClick={handleSaveDisplay} disabled={savingDisplay} className="bg-[#1B2A4A] text-white">
              {savingDisplay && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>

        {/* Alerts */}
        <TabsContent value="alerts">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Low Stock Alert Threshold (days of supply)</Label>
              <Input
                type="number"
                min={0}
                value={lowStockDays}
                onChange={e => setLowStockDays(e.target.value)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-gray-400">Alert when estimated supply drops below this many days</p>
            </div>

            <div className="space-y-1.5">
              <Label>Expiry Alert (days before expiry)</Label>
              <Input
                type="number"
                min={1}
                value={expiryDays}
                onChange={e => setExpiryDays(e.target.value)}
                className="max-w-[120px]"
              />
              <p className="text-xs text-gray-400">Show expiry alert this many days before the expiry date</p>
            </div>

            <Separator />
            <Button onClick={handleSaveDisplay} disabled={savingDisplay} className="bg-[#1B2A4A] text-white">
              {savingDisplay && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
