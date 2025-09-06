import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

export let supabase: SupabaseClient | null = null

if (!url) {
  console.warn('SUPABASE_URL not set. Supabase client will not be initialized.')
} else if (!anonKey) {
  console.warn('SUPABASE key not set. Supabase client will not be initialized.')
} else {
  supabase = createClient(url, anonKey)
}
