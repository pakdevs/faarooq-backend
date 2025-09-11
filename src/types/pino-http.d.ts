declare module 'pino-http' {
  interface Options {
    redact?: any
    customProps?: () => Record<string, any>
  }
  type Handler = (opts?: Options) => any
  const pinoHttp: Handler
  export default pinoHttp
}
