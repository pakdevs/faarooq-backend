import { dequeueMediaJobs } from '../lib/jobQueue'
import { supabaseAdmin } from '../lib/supabase'

async function processOnce() {
  const jobs = await dequeueMediaJobs(20)
  if (!jobs.length) return
  for (const job of jobs) {
    if (!supabaseAdmin) continue
    try {
      if (job.type === 'probe') {
        // Placeholder: we could HEAD request the URL to confirm content-type/length
        await supabaseAdmin
          .from('media')
          .update({ meta: { probed_at: new Date().toISOString() } })
          .eq('id', job.mediaId)
      } else if (job.type === 'thumbnail') {
        // Placeholder: real implementation would download, generate thumb, upload & update meta
        await supabaseAdmin
          .from('media')
          .update({ meta: { thumb_pending: false, thumb_generated_at: new Date().toISOString() } })
          .eq('id', job.mediaId)
      }
    } catch (e) {
      // swallow; add logging if needed
      // eslint-disable-next-line no-console
      console.error('media_job_failed', job, e)
    }
  }
}

async function loop() {
  while (true) {
    await processOnce()
    await new Promise((r) => setTimeout(r, 2000))
  }
}

if (require.main === module) {
  loop().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('worker_exit', e)
    process.exit(1)
  })
}
