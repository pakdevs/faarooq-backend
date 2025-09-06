import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { router as authRouter } from './routes/auth'
import { router as usersRouter } from './routes/users'
import { router as postsRouter } from './routes/posts'
import { router as followsRouter } from './routes/follows'
import { router as likesRouter } from './routes/likes'
import { router as notificationsRouter } from './routes/notifications'

const app = express()

app.use(helmet())
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

const limiter = rateLimit({ windowMs: 60 * 1000, max: 120 })
app.use(limiter)

app.get('/health', (req: Request, res: Response) => {
  res.json({ ok: true, uptime: process.uptime() })
})

app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/posts', postsRouter)
app.use('/api/follows', followsRouter)
app.use('/api/likes', likesRouter)
app.use('/api/notifications', notificationsRouter)

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' })
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err)
  res.status(err?.status || 500).json({ error: err?.message || 'Internal Server Error' })
})

const port = process.env.PORT ? Number(process.env.PORT) : 3000
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
