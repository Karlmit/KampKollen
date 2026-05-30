import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../api/client'
import { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (data: { username: string; password: string; displayName?: string; realName?: string }) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  isAdmin: boolean
  isScorekeeper: boolean
  hasUnopenedTrophies: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadTrophyCount, setUnreadTrophyCount] = useState(0)

  useEffect(() => {
    api.auth.me()
      .then(res => { setUser(res.user); setUnreadTrophyCount((res as any).unreadTrophyCount ?? 0) })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (username: string, password: string) => {
    const res = await api.auth.login({ username, password })
    setUser(res.user)
  }

  const register = async (data: { username: string; password: string; displayName?: string; realName?: string }) => {
    const res = await api.auth.register(data)
    setUser(res.user)
  }

  const logout = async () => {
    try {
      await api.auth.logout()
    } catch {
      // clear local state regardless of API result
    }
    setUser(null)
    setUnreadTrophyCount(0)
  }

  const refreshUser = async () => {
    const res = await api.auth.me()
    setUser(res.user)
    setUnreadTrophyCount((res as any).unreadTrophyCount ?? 0)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAdmin: user?.globalRole === 'ADMIN',
      isScorekeeper: user?.globalRole === 'SCOREKEEPER' || user?.globalRole === 'ADMIN',
      hasUnopenedTrophies: unreadTrophyCount > 0,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
