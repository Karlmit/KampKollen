import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db.js'
import { hashPassword, verifyPassword, validatePassword, validateUsername } from '../lib/auth.js'

const registerSchema = z.object({
  username: z.string().min(2).max(32),
  password: z.string().min(4).max(128),
  realName: z.string().max(128).optional(),
})

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: body.error.issues[0].message })
    }

    const { username, password, realName } = body.data

    const usernameError = validateUsername(username)
    if (usernameError) return reply.status(400).send({ error: usernameError })

    const passwordError = validatePassword(password)
    if (passwordError) return reply.status(400).send({ error: passwordError })

    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return reply.status(409).send({ error: 'Username already taken' })
    }

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { username, passwordHash, displayName: username, realName },
      select: { id: true, username: true, displayName: true, realName: true, globalRole: true, profileImageUrl: true },
    })

    const token = app.jwt.sign({ id: user.id, username: user.username, role: user.globalRole })
    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return reply.status(201).send({ user, token })
  })

  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid request' })
    }

    const { username, password } = body.data
    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || user.isDummy || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid username or password' })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid username or password' })
    }

    const token = app.jwt.sign({ id: user.id, username: user.username, role: user.globalRole })
    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    const { passwordHash: _, ...userSafe } = user
    return { user: userSafe, token }
  })

  app.post('/logout', async (request, reply) => {
    reply.clearCookie('token', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })
    return { success: true }
  })

  app.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Not authenticated' })
    }

    const jwtUser = request.user as { id: string }
    const user = await prisma.user.findUnique({
      where: { id: jwtUser.id },
      select: {
        id: true, username: true, displayName: true, realName: true,
        profileImageUrl: true, globalRole: true, createdAt: true,
      },
    })

    if (!user) return reply.status(404).send({ error: 'User not found' })
    return { user }
  })
}
