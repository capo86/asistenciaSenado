import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

export const isDataServiceConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
)

export const supabase = isDataServiceConfigured
  ? createClient(supabaseUrl as string, supabasePublishableKey as string)
  : null
