'use client'

import { useState, useMemo } from 'react'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, ClipboardList } from 'lucide-react'

interface Log {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  old_value: any
  new_value: any
  ip_address: string | null
  created_at: string
  users: { full_name: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 border-green-200',
  update: 'bg-blue-100 text-blue-700 border-blue-200',
  delete: 'bg-red-100 text-red-600 border-red-200',
  login: 'bg-purple-100 text-purple-700 border-purple-200',
  logout: 'bg-gray-100 text-gray-600 border-gray-200',
  void: 'bg-red-100 text-red-600 border-red-200',
  receive: 'bg-amber-100 text-amber-700 border-amber-200',
}

function getActionColor(action: string): string {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k))
  return key ? ACTION_COLORS[key] : 'bg-gray-100 text-gray-600 border-gray-200'
}

export function LogsClient({ initialLogs }: { initialLogs: Log[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return initialLogs
    const q = search.toLowerCase()
    return initialLogs.filter(l =>
      l.action.toLowerCase().includes(q) ||
      (l.entity_type ?? '').toLowerCase().includes(q) ||
      (l.users?.full_name ?? '').toLowerCase().includes(q)
    )
  }, [initialLogs, search])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
        <p className="text-sm text-gray-500 mt-1">Audit trail of all user actions</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="Search actions, users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
            <ClipboardList className="h-10 w-10" />
            <p className="text-sm">No activity logged yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-medium">
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{log.users?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${getActionColor(log.action)}`}>{log.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {log.entity_type && <span className="capitalize">{log.entity_type}</span>}
                      {log.entity_id && <span className="text-gray-300 ml-1 font-mono">{log.entity_id.slice(0, 8)}…</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
