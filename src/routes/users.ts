import { Router, Request, Response } from 'express'
import { supabase } from '../lib/supabase'

export const router = Router()

router.get('/:id', async (req: Request, res: Response) => {
  const id = req.params.id
  if (!supabase) return res.json({ id, handle: 'stub', display_name: 'Stub' })
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
  if (error || !data) return res.status(404).json({ error: 'User not found' })
  return res.json(data)
})
