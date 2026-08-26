import { createClient } from '@supabase/supabase-js'

// Both values are public by design: the publishable key only grants what the
// database's row-level-security policies allow (read live posts, insert sane
// posts). Everything privileged stays server-side at Supabase.
export const supa = createClient(
  'https://hxmjszgvkynrwscelnzx.supabase.co',
  'sb_publishable_dsbMk3uhJmqQjZeYkFC3Ng_OPhiN-CX',
)
