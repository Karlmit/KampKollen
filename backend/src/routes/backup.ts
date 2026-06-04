import { FastifyInstance } from 'fastify'
import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'
import { prisma } from '../db.js'
import { requireAdmin } from '../middleware/auth.js'
import { config } from '../config.js'

export async function backupRoutes(app: FastifyInstance) {
  // ── Download backup ──────────────────────────────────────────────────────────
  app.get('/download', { preHandler: requireAdmin }, async (_request, reply) => {
    const [users, challenges, competitions, competitionChallenges, teams, competitionPlayers, scores, trophies, settings] =
      await Promise.all([
        prisma.user.findMany(),
        prisma.challenge.findMany(),
        prisma.competition.findMany(),
        prisma.competitionChallenge.findMany(),
        prisma.team.findMany(),
        prisma.competitionPlayer.findMany(),
        prisma.score.findMany(),
        prisma.trophy.findMany(),
        prisma.setting.findMany(),
      ])

    const data = JSON.stringify({
      version: '1',
      exportedAt: new Date().toISOString(),
      users,
      challenges,
      competitions,
      competitionChallenges,
      teams,
      competitionPlayers,
      scores,
      trophies,
      settings,
    }, null, 2)

    const zip = new AdmZip()
    zip.addFile('data.json', Buffer.from(data, 'utf8'))

    // Add all uploaded images
    function addDir(dirPath: string, zipPrefix: string) {
      if (!fs.existsSync(dirPath)) return
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          addDir(full, `${zipPrefix}${entry.name}/`)
        } else {
          zip.addLocalFile(full, zipPrefix)
        }
      }
    }
    addDir(config.uploadsDir, 'uploads/')

    const buf = zip.toBuffer()
    const filename = `kampkollen-backup-${new Date().toISOString().slice(0, 10)}.zip`

    reply
      .header('Content-Type', 'application/zip')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', buf.length)
      .send(buf)
  })

  // ── Restore backup ───────────────────────────────────────────────────────────
  app.post('/restore', { preHandler: requireAdmin }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buf = Buffer.concat(chunks)

    let parsed: any
    try {
      const zip = new AdmZip(buf)
      const entry = zip.getEntry('data.json')
      if (!entry) return reply.status(400).send({ error: 'Invalid backup: missing data.json' })
      parsed = JSON.parse(zip.readAsText(entry))

      // Restore images
      for (const entry of zip.getEntries()) {
        if (entry.entryName.startsWith('uploads/') && !entry.isDirectory) {
          const rel = entry.entryName.slice('uploads/'.length)
          const dest = path.join(config.uploadsDir, rel)
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.writeFileSync(dest, entry.getData())
        }
      }
    } catch {
      return reply.status(400).send({ error: 'Failed to read backup file' })
    }

    const { users, challenges, competitions, competitionChallenges, teams, competitionPlayers, scores, trophies, settings } = parsed

    await prisma.$transaction(async tx => {
      // Delete in reverse FK order
      await tx.score.deleteMany()
      await tx.trophy.deleteMany()
      await tx.competitionPlayer.deleteMany()
      await tx.competitionChallenge.deleteMany()
      await tx.team.deleteMany()
      await tx.competition.deleteMany()
      await tx.challenge.deleteMany()
      await tx.user.deleteMany()
      await tx.setting.deleteMany()

      // Re-insert in FK order
      if (users?.length)                await tx.user.createMany({ data: users })
      if (challenges?.length)            await tx.challenge.createMany({ data: challenges })
      if (competitions?.length)          await tx.competition.createMany({ data: competitions })
      if (competitionChallenges?.length) await tx.competitionChallenge.createMany({ data: competitionChallenges })
      if (teams?.length)                 await tx.team.createMany({ data: teams })
      if (competitionPlayers?.length)    await tx.competitionPlayer.createMany({ data: competitionPlayers })
      if (scores?.length)                await tx.score.createMany({ data: scores })
      if (trophies?.length)              await tx.trophy.createMany({ data: trophies })
      if (settings?.length)              await tx.setting.createMany({ data: settings })
    }, { timeout: 60000 })

    return { success: true }
  })
}
