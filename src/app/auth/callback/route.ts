import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const routes: Record<string, string> = {
          admin: '/admin',
          contractor: '/contractor',
          customer: '/customer',
        }
        return NextResponse.redirect(`${origin}${routes[profile?.role ?? ''] ?? '/login'}`)
      }
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
