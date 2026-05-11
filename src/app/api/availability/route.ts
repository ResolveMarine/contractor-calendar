import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { UpsertAvailabilityInput } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const contractorId = searchParams.get('contractor_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  if (!contractorId || !year || !month)
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const y = parseInt(year), m = parseInt(month)
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const to = new Date(y, m + 1, 0).toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('contractor_id', contractorId)
    .gte('date', from)
    .lte('date', to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body: UpsertAvailabilityInput = await req.json()

  const { data: contractor } = await supabase
    .from('contractors').select('id').eq('id', body.contractor_id).eq('profile_id', user.id).single()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!contractor && profile?.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('availability')
    .upsert(
      { contractor_id: body.contractor_id, date: body.date, status: body.status, note: body.note ?? null },
      { onConflict: 'contractor_id,date' }
    )
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
