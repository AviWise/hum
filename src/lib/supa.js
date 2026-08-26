import { createClient } from '@supabase/supabase-js'

// Both values are public by design: the publishable key only grants what the
// database's row-level-security policies allow (read live posts; write only
// with a signed-in session). Everything privileged stays server-side at Supabase.
export const SUPA_URL = 'https://hxmjszgvkynrwscelnzx.supabase.co'
export const SUPA_KEY = 'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX'

export const supa = createClient(SUPA_URL, SUPA_KEY)
