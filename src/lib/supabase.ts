import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

export let supabaseAdmin: SupabaseClient | null = null

if (!url) {
  console.warn('SUPABASE_URL not set. Supabase clients will not be initialized.')
} else {
  if (serviceRoleKey) {
    supabaseAdmin = createClient(url, serviceRoleKey)
    console.info('Supabase admin client initialized (service_role key).')
  } else {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Admin features disabled.')
  }
}

export function getRlsClient(accessToken?: string): SupabaseClient | null {
  if (!url || !anonKey) {
    return null
  }
  const headers: Record<string, string> = {}
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  return createClient(url, anonKey, {
    global: { headers },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
