import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'path'
import { config } from './config.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { competitionRoutes } from './routes/competitions.js'
import { challengeRoutes } from './routes/challenges.js'
import { teamRoutes } from './routes/teams.js'
import { scoreRoutes } from './routes/scores.js'
import { leaderboardRoutes } from './routes/leaderboards.js'
import { settingsRoutes } from './routes/settings.js'

export async function buildServer() {
  const app = Fastify({
    logger: config.isDev ? { level: 'info' } : false,
    trustProxy: true,
  })

  await app.register(fastifyCookie, { secret: config.cookieSecret })
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: 'token', signed: false },
  })
  await app.register(fastifyCors, {
    origin: config.isDev ? true : config.frontendUrl,
    credentials: true,
  })

  // Serve uploaded images
  await app.register(fastifyStatic, {
    root: config.uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  })

  // Serve built frontend (in production)
  const publicDir = path.resolve(process.cwd(), 'public')
  if (!config.isDev) {
    await app.register(fastifyStatic, {
      root: publicDir,
      prefix: '/',
      wildcard: false,
    })
  }

  // API routes
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(userRoutes, { prefix: '/api/users' })
  await app.register(competitionRoutes, { prefix: '/api/competitions' })
  await app.register(challengeRoutes, { prefix: '/api/challenges' })
  await app.register(teamRoutes, { prefix: '/api/teams' })
  await app.register(scoreRoutes, { prefix: '/api/scores' })
  await app.register(leaderboardRoutes, { prefix: '/api/leaderboards' })
  await app.register(settingsRoutes, { prefix: '/api/admin/settings' })

  // Catch-all for SPA — serve index.html for all non-API routes in production
  if (!config.isDev) {
    app.setNotFoundHandler(async (request, reply) => {
      if (!request.url.startsWith('/api/') && !request.url.startsWith('/uploads/')) {
        return reply.sendFile('index.html', publicDir)
      }
      return reply.status(404).send({ error: 'Not found' })
    })
  }

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error)
    reply.status(error.statusCode ?? 500).send({
      error: error.message ?? 'Internal server error',
    })
  })

  return app
}
