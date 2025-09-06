import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

export let supabase: SupabaseClient | null = null

if (!url) {
  console.warn('SUPABASE_URL not set. Supabase client will not be initialized.')
} else if (!key) {
  console.warn('SUPABASE key not set. Supabase client will not be initialized.')
} else {
  supabase = createClient(url, key)
  console.info(`Supabase client initialized (${usingServiceRole ? 'service_role' : 'anon'} key).`)
}
