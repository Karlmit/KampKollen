import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface GroupContextValue {
  activeGroupId: string | null
  setActiveGroupId: (id: string | null) => void
}

const GroupContext = createContext<GroupContextValue>({ activeGroupId: null, setActiveGroupId: () => {} })

export function GroupProvider({ children }: { children: ReactNode }) {
  const [activeGroupId, setActiveGroupIdState] = useState<string | null>(() => {
    try { return localStorage.getItem('activeGroupId') } catch { return null }
  })

  function setActiveGroupId(id: string | null) {
    setActiveGroupIdState(id)
    try {
      if (id) localStorage.setItem('activeGroupId', id)
      else localStorage.removeItem('activeGroupId')
    } catch {}
  }

  return (
    <GroupContext.Provider value={{ activeGroupId, setActiveGroupId }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() { return useContext(GroupContext) }
