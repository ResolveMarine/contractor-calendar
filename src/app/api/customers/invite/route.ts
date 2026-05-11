import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase'
import type { CreateInviteInput } from '@/types'

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: CreateInviteInput = await req.json()
  if (!body.email || !body.company)
    return NextResponse.json({ error: 'email and company required' }, { status: 400 })

  const { data: invite, error: inviteError } = await supabase
    .from('customer_invites')
    .upsert({ email: body.email, company: body.company, invited_by: user.id, status: 'pending' }, { onConflict: 'email' })
    .select().single()

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  const adminClient = createAdminClient()
  const { error: otpError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: body.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
  })

  if (otpError) return NextResponse.json({ error: otpError.message }, { status: 500 })
  return NextResponse.json({ invite, message: 'Magic link sent' }, { status: 201 })
}

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('customer_invites').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const user = await requireAdmin(supabase)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  const { data, error } = await supabase.from('customer_invites').update({ status: 'revoked' }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
