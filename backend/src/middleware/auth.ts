import { FastifyRequest, FastifyReply } from 'fastify'
import { GlobalRole } from '@prisma/client'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'Authentication required' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const user = request.user as { role: GlobalRole }
    if (user.role !== GlobalRole.ADMIN) {
      return reply.status(403).send({ error: 'Admin access required' })
    }
  } catch {
    return reply.status(401).send({ error: 'Authentication required' })
  }
}

export async function optionalAuth(request: FastifyRequest) {
  try { await request.jwtVerify() } catch { /* unauthenticated — request continues */ }
}
