// All monetary values are stored as integers (cents for USD, piasters for LBP).
// Exchange rate is stored as integer × 1000 (90000 = 90,000 LBP/USD).

export function centsToUsd(cents: number): number {
  return cents / 100
}

export function usdToCents(usd: number): number {
  return Math.round(usd * 100)
}

export function piastersToLbp(piasters: number): number {
  return piasters / 100
}

export function lbpToPiasters(lbp: number): number {
  return Math.round(lbp * 100)
}

export function exchangeRateValue(storedRate: number): number {
  return storedRate / 1000
}

export function usdCentsToLbpPiasters(usdCents: number, storedRate: number): number {
  const rate = exchangeRateValue(storedRate)
  return Math.round(usdCents * rate)
}

export function formatUsd(cents: number): string {
  return `$${centsToUsd(cents).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatLbp(piasters: number): string {
  const lbp = piastersToLbp(piasters)
  return `LL ${lbp.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatRate(storedRate: number): string {
  return exchangeRateValue(storedRate).toLocaleString('en-US')
}
