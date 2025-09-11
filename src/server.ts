import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import path from 'path'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { randomUUID } from 'crypto'

import { router as authRouter } from './routes/auth'
import { router as usersRouter } from './routes/users'
import { router as postsRouter } from './routes/posts'
import { router as followsRouter } from './routes/follows'
import { router as likesRouter } from './routes/likes'
import { router as notificationsRouter } from './routes/notifications'
import { router as repostsRouter } from './routes/reposts'
import { router as mediaRouter } from './routes/media'
import { router as moderationRouter } from './routes/moderation'
import { metricsMiddleware, metricsSnapshot, metricsPrometheus } from './middleware/metrics'
import { loadSecurityConfig, helmetCspFromDirectives } from './config/security'

const app = express()

// Structured logging
const logger = pinoHttp({
  redact: ['req.headers.authorization'],
  customProps: () => ({ service: 'faarooq-api' }),
})
app.use(logger)

// Request ID middleware (if not already set by proxy)
app.use((req, _res, next) => {
  ;(req as any).id = req.headers['x-request-id'] || randomUUID()
  next()
})

const sec = loadSecurityConfig()
// Type workaround casts due to transient express type overload issues
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: helmetCspFromDirectives(sec.cspDirectives) as any,
    },
    crossOriginEmbedderPolicy: false, // avoid issues with some CDNs
  }) as any
)
app.use(
  cors({
    origin:
      sec.corsOrigins === '*'
        ? '*'
        : (origin, cb) => {
            if (!origin) return cb(null, true)
            if (sec.corsOrigins === '*' || sec.corsOrigins.includes(origin)) return cb(null, true)
            return cb(new Error('Not allowed by CORS'))
          },
    credentials: false,
  }) as any
)
const globalBodyLimit = process.env.GLOBAL_JSON_LIMIT || '512kb'
app.use(express.json({ limit: globalBodyLimit }) as any)
app.use(morgan('dev') as any) // keep concise console access log in dev
app.use(metricsMiddleware())

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 })
app.use(limiter)

app.get('/health', (req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.get('/metrics', (_req: Request, res: Response) => {
  const snap = metricsSnapshot()
  res.json({ windowSeconds: 60, ...snap })
})

app.get('/metrics.prom', (_req: Request, res: Response) => {
  res.type('text/plain').send(metricsPrometheus())
})

// OpenAPI spec and docs
app.get('/openapi.json', (_req: Request, res: Response) => {
  const specPath = path.resolve(process.cwd(), 'openapi.json')
  res.sendFile(specPath)
})

app.get('/docs', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Faarooq API Docs</title>
      <style>body { margin: 0; padding: 0; }</style>
    </head>
    <body>
      <redoc spec-url="/openapi.json"></redoc>
      <script src="https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js"></script>
    </body>
  </html>`
  res.type('html').send(html)
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)
app.use('/api/follows', followsRouter)
app.use('/api/likes', likesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/reposts', repostsRouter)
app.use('/api/media', mediaRouter)
app.use('/api/moderation', moderationRouter)

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Not Found' } })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  req.log?.error({ err, reqId: (req as any).id }, 'request_error')
  const status = err?.status && Number.isInteger(err.status) ? err.status : 500
  const code = err?.code || (status === 500 ? 'server_error' : 'error')
  const message = err?.message || (status === 500 ? 'Internal Server Error' : 'Error')
  res.status(status).json({ error: { code, message } })
})

const port = process.env.PORT ? Number(process.env.PORT) : 3000
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
