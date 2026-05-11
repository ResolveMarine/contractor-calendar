import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  redirect(routes[profile?.role ?? ''] ?? '/login')
}
