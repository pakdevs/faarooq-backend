import 'express'

declare module 'express-serve-static-core' {
  interface Request {
    log?: any
    id?: string | string[]
  }
}
