import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { CreateEnquiryInput } from '@/types'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'customer')
    return NextResponse.json({ error: 'Only customers can submit enquiries' }, { status: 403 })

  const body: CreateEnquiryInput = await req.json()
  if (!body.contractor_id || !body.message)
    return NextResponse.json({ error: 'contractor_id and message required' }, { status: 400 })

  const { data, error } = await supabase.from('enquiries')
    .insert({ customer_id: user.id, contractor_id: body.contractor_id, preferred_dates: body.preferred_dates ?? null, message: body.message, contact_name: body.contact_name ?? null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  let query = supabase.from('enquiries')
    .select('*, customer:profiles!customer_id(id,full_name,company), contractor:contractors!contractor_id(id,alias,specialty)')
    .order('created_at', { ascending: false })

  if (profile?.role === 'customer') query = query.eq('customer_id', user.id)
  else if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, status, admin_notes } = await req.json()
  const { data, error } = await supabase.from('enquiries').update({ status, admin_notes }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
