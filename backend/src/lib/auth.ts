import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function validatePassword(password: string): string | null {
  if (password.length < 4) return 'Password must be at least 4 characters'
  if (password.length > 128) return 'Password must be at most 128 characters'
  return null
}

export function validateUsername(username: string): string | null {
  if (username.length < 2) return 'Username must be at least 2 characters'
  if (username.length > 32) return 'Username must be at most 32 characters'
  if (!/^[a-zA-ZåäöÅÄÖ0-9_-]+$/.test(username)) {
    return 'Username may only contain letters, numbers, hyphens, and underscores'
  }
  return null
}
