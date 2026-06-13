const BASE = 'api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  auth: {
    register: (data: { username: string; password: string; displayName?: string; realName?: string }) =>
      request<{ user: any; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { username: string; password: string }) =>
      request<{ user: any; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: any }>('/auth/me'),
  },

  // Users
  users: {
    list: () => request<{ users: any[] }>('/users'),
    get: (id: string) => request<{ user: any }>(`/users/${id}`),
    update: (id: string, data: any) => request<{ user: any }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
    generateImage: (id: string, prompt?: string) =>
      request<{ user: any; imageUrl: string }>(`/users/${id}/generate-image`, { method: 'POST', body: JSON.stringify({ prompt }) }),
  },

  // Competitions
  competitions: {
    list: () => request<{ competitions: any[] }>('/competitions'),
    get: (id: string) => request<{ competition: any }>(`/competitions/${id}`),
    create: (data: any) => request<{ competition: any }>('/competitions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<{ competition: any }>(`/competitions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    generateImage: (id: string, prompt?: string) =>
      request<{ competition: any; imageUrl: string }>(`/competitions/${id}/generate-image`, { method: 'POST', body: JSON.stringify({ prompt }) }),
    join: (id: string) => request<{ player: any }>(`/competitions/${id}/join`, { method: 'POST' }),
    addChallenge: (id: string, data: any) => request(`/competitions/${id}/challenges`, { method: 'POST', body: JSON.stringify(data) }),
    removeChallenge: (id: string, challengeId: string) => request(`/competitions/${id}/challenges/${challengeId}`, { method: 'DELETE' }),
    reorderChallenges: (id: string, order: string[]) => request(`/competitions/${id}/challenges/reorder`, { method: 'PUT', body: JSON.stringify({ order }) }),
    addPlayer: (id: string, data: any) => request(`/competitions/${id}/players`, { method: 'POST', body: JSON.stringify(data) }),
    updatePlayer: (id: string, userId: string, data: any) => request(`/competitions/${id}/players/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
    removePlayer: (id: string, userId: string) => request(`/competitions/${id}/players/${userId}`, { method: 'DELETE' }),
    createDummyPlayer: (id: string, data: { name: string; teamId?: string }) =>
      request<{ player: any }>(`/competitions/${id}/players/dummy`, { method: 'POST', body: JSON.stringify(data) }),
    convertDummyPlayer: (id: string, dummyUserId: string, data: { realUserId: string }) =>
      request<{ success: boolean }>(`/competitions/${id}/players/dummy/${dummyUserId}/convert`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // Challenges
  challenges: {
    list: () => request<{ challenges: any[] }>('/challenges'),
    get: (id: string) => request<{ challenge: any }>(`/challenges/${id}`),
    create: (data: any) => request<{ challenge: any }>('/challenges', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<{ challenge: any }>(`/challenges/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/challenges/${id}`, { method: 'DELETE' }),
    generateImage: (id: string, prompt?: string) =>
      request<{ challenge: any; imageUrl: string }>(`/challenges/${id}/generate-image`, { method: 'POST', body: JSON.stringify({ prompt }) }),
    allTimeScores: (id: string) => request<{ challenge: any; scores: any[] }>(`/challenges/all-time/${id}`),
  },

  // Teams
  teams: {
    listForCompetition: (competitionId: string) => request<{ teams: any[] }>(`/teams/competition/${competitionId}`),
    get: (id: string) => request<{ team: any }>(`/teams/${id}`),
    create: (competitionId: string, data: any) => request<{ team: any }>(`/teams/competition/${competitionId}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<{ team: any }>(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/teams/${id}`, { method: 'DELETE' }),
    addPlayer: (id: string, userId: string) => request(`/teams/${id}/players`, { method: 'POST', body: JSON.stringify({ userId }) }),
    removePlayer: (id: string, userId: string) => request(`/teams/${id}/players/${userId}`, { method: 'DELETE' }),
    generateImage: (id: string, prompt?: string) =>
      request<{ team: any; imageUrl: string }>(`/teams/${id}/generate-image`, { method: 'POST', body: JSON.stringify({ prompt }) }),
  },

  // Scores
  scores: {
    forCompetition: (competitionId: string) => request<{ scores: any[] }>(`/scores/competition/${competitionId}`),
    forChallenge: (competitionId: string, ccId: string) => request<{ scores: any[] }>(`/scores/competition/${competitionId}/challenge/${ccId}`),
    upsert: (competitionId: string, ccId: string, data: any) =>
      request<{ score: any }>(`/scores/competition/${competitionId}/challenge/${ccId}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<{ score: any }>(`/scores/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/scores/${id}`, { method: 'DELETE' }),
  },

  // Admin settings
  settings: {
    get: () => request<{ settings: Record<string, string>; envDefaults: Record<string, string> }>('/admin/settings'),
    update: (data: Record<string, string>) => request('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Image prompt options (subjects/clothes/accessories)
  imageOptions: {
    get: () => request<{ subjects: string[]; clothes: string[]; accessories: string[] }>('/image-options'),
    update: (data: { subjects?: string[]; clothes?: string[]; accessories?: string[] }) =>
      request<{ success: boolean }>('/image-options', { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Trophies
  trophies: {
    getStatus: () => request<{ storageCount: number; generating: number; activeCompetitions: { id: string; name: string; challengeCount: number; maxTeamSize: number; needed: number }[] }>('/trophies/status'),
    ensureForCompetition: (competitionId: string) => request<{ started: boolean }>(`/trophies/ensure-for-competition/${competitionId}`, { method: 'POST' }),
    getStorage: () => request<{ trophies: any[] }>('/trophies/storage'),
    getForUser: (userId: string) => request<{ trophies: any[] }>(`/trophies/user/${userId}`),
    history: (groupId?: string | null) => request<{ players: any[] }>(`/trophies/history${groupId ? `?groupId=${groupId}` : ''}`),
    generate: (word?: string) => request<{ trophy: any }>('/trophies/generate', { method: 'POST', body: JSON.stringify({ word }) }),
    reserve: (id: string, competitionId: string | null) => request<{ trophy: any }>(`/trophies/${id}/reserve`, { method: 'PUT', body: JSON.stringify({ competitionId }) }),
    generateSend: (userId: string) => request<{ trophy: any }>('/trophies/generate-send', { method: 'POST', body: JSON.stringify({ userId }) }),
    send: (id: string, userId: string) => request<{ trophy: any }>(`/trophies/${id}/send`, { method: 'POST', body: JSON.stringify({ userId }) }),
    takeBack: (id: string) => request<{ trophy: any }>(`/trophies/${id}/take-back`, { method: 'POST', body: '{}' }),
    open: (id: string) => request<{ trophy: any }>(`/trophies/${id}/open`, { method: 'POST', body: '{}' }),
    delete: (id: string) => request(`/trophies/${id}`, { method: 'DELETE' }),
    getWords: () => request<{ words: string[] }>('/admin/trophy-words'),
    updateWords: (words: string[]) => request<{ success: boolean }>('/admin/trophy-words', { method: 'PUT', body: JSON.stringify({ words }) }),
  },

  // Quiz
  quiz: {
    getState: (ccId: string) => request<any>(`/quiz/${ccId}/state`),
    createQuestion: (data: { challengeId: string; text: string; points?: number; timerSeconds?: number; isFreeText?: boolean }) =>
      request<{ question: any }>('/quiz/questions', { method: 'POST', body: JSON.stringify(data) }),
    updateQuestion: (id: string, data: { text?: string; points?: number; timerSeconds?: number; isFreeText?: boolean }) =>
      request<{ question: any }>(`/quiz/questions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteQuestion: (id: string) => request(`/quiz/questions/${id}`, { method: 'DELETE' }),
    reorderQuestions: (order: string[]) => request('/quiz/questions/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
    reorderOptions: (order: string[]) => request('/quiz/options/reorder', { method: 'PUT', body: JSON.stringify({ order }) }),
    uploadQuestionImage: (id: string, file: File) => {
      const form = new FormData(); form.append('file', file)
      return fetch(`api/quiz/questions/${id}/image`, { method: 'POST', credentials: 'include', body: form })
        .then(r => r.json()) as Promise<{ imageUrl: string }>
    },
    createOption: (questionId: string, data: { text: string; isCorrect?: boolean }) =>
      request<{ option: any }>(`/quiz/questions/${questionId}/options`, { method: 'POST', body: JSON.stringify(data) }),
    updateOption: (id: string, data: { text?: string; isCorrect?: boolean }) =>
      request<{ option: any }>(`/quiz/options/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteOption: (id: string) => request(`/quiz/options/${id}`, { method: 'DELETE' }),
    uploadOptionImage: (id: string, file: File) => {
      const form = new FormData(); form.append('file', file)
      return fetch(`api/quiz/options/${id}/image`, { method: 'POST', credentials: 'include', body: form })
        .then(r => r.json()) as Promise<{ imageUrl: string }>
    },
    markReady: (ccId: string, teamId?: string) =>
      request(`/quiz/${ccId}/session/ready`, { method: 'POST', body: JSON.stringify({ teamId }) }),
    start: (ccId: string) => request(`/quiz/${ccId}/session/start`, { method: 'POST', body: '{}' }),
    nextQuestion: (ccId: string) => request(`/quiz/${ccId}/session/next-question`, { method: 'POST', body: '{}' }),
    lockQuestion: (ccId: string) => request(`/quiz/${ccId}/session/lock-question`, { method: 'POST', body: '{}' }),
    showAnswer: (ccId: string) => request(`/quiz/${ccId}/session/show-answer`, { method: 'POST', body: '{}' }),
    nextCorrection: (ccId: string) => request(`/quiz/${ccId}/session/next-correction`, { method: 'POST', body: '{}' }),
    complete: (ccId: string) => request(`/quiz/${ccId}/session/complete`, { method: 'POST', body: '{}' }),
    submitAnswer: (ccId: string, data: { questionId: string; optionId?: string; freeTextAnswer?: string; teamId?: string }) =>
      request(`/quiz/${ccId}/answers`, { method: 'POST', body: JSON.stringify(data) }),
    setFreeTextPoints: (ccId: string, answerId: string, points: number) =>
      request(`/quiz/${ccId}/answers/${answerId}/points`, { method: 'PUT', body: JSON.stringify({ points }) }),
    toggleFreeTextLock: (ccId: string, answerId: string) =>
      request(`/quiz/${ccId}/answers/${answerId}/lock`, { method: 'PUT', body: '{}' }),
    setQuizMaster: (compId: string, userId: string, isQuizMaster: boolean) =>
      request(`/quiz/competition/${compId}/players/${userId}/quiz-master`, { method: 'PUT', body: JSON.stringify({ isQuizMaster }) }),
  },

  // Groups
  groups: {
    listPublic: () => request<{ groups: any[] }>('/groups/public'),
    list: () => request<{ groups: any[] }>('/groups'),
    create: (name: string) => request<{ group: any }>('/groups', { method: 'POST', body: JSON.stringify({ name }) }),
    members: (groupId: string) => request<{ members: any[] }>(`/groups/${groupId}/members`),
    addMember: (groupId: string, userId: string) => request<{ success: boolean }>(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ userId }) }),
    removeMember: (groupId: string, userId: string) => request<{ success: boolean }>(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),
  },

  // Backup
  backup: {
    download: async () => {
      const res = await fetch('api/admin/backup/download', { credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new ApiError(res.status, body.error ?? 'Download failed')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'kampkollen-backup.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    restore: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return fetch('api/admin/backup/restore', { method: 'POST', credentials: 'include', body: form })
        .then(async res => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }))
            throw new ApiError(res.status, body.error ?? 'Restore failed')
          }
          return res.json() as Promise<{ success: boolean }>
        })
    },
  },

  // Leaderboards
  leaderboards: {
    competition: (id: string) => request<any>(`/leaderboards/competition/${id}`),
    historical: (groupId?: string | null) => request<{ competitions: any[] }>(`/leaderboards/historical${groupId ? `?groupId=${groupId}` : ''}`),
    allTimeChallenge: (challengeId: string, groupId?: string | null) => request<any>(`/leaderboards/challenge/${challengeId}/all-time${groupId ? `?groupId=${groupId}` : ''}`),
    challengesAllTime: (groupId?: string | null) => request<any>(`/leaderboards/challenges/all-time${groupId ? `?groupId=${groupId}` : ''}`),
  },
}

export { ApiError }
