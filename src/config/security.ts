interface SecurityConfig {
  corsOrigins: string[] | '*'
  cspDirectives: Record<string, string[]>
}

export function loadSecurityConfig(): SecurityConfig {
  const originsEnv = process.env.CORS_ORIGINS // comma separated or *
  let corsOrigins: string[] | '*' = '*'
  if (originsEnv && originsEnv.trim() && originsEnv.trim() !== '*') {
    corsOrigins = originsEnv
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  }
  const csp = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
    'style-src': ["'self'", 'https://cdn.jsdelivr.net', "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return { corsOrigins, cspDirectives: csp }
}

export function helmetCspFromDirectives(directives: Record<string, string[]>) {
  const csp: Record<string, string> = {}
  for (const [k, v] of Object.entries(directives)) {
    csp[k] = v.join(' ')
  }
  return csp
}
