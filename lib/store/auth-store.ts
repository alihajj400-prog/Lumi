import { create } from 'zustand'
import type { UserProfile, Organization, Branch, OrgSettings } from '@/lib/supabase/types'

interface AuthState {
  user: UserProfile | null
  organization: Organization | null
  branch: Branch | null
  settings: OrgSettings | null
  setAuth: (data: {
    user: UserProfile
    organization: Organization
    branch: Branch
    settings: OrgSettings
  }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  branch: null,
  settings: null,
  setAuth: (data) => set(data),
  clearAuth: () => set({ user: null, organization: null, branch: null, settings: null }),
}))
