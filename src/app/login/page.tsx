'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) setError('Something went wrong. Please try again.')
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'linear-gradient(135deg,#f0f9ff 0%,#e6f7f5 100%)'}}>
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
         <img src="/logo.jpg" alt="Resolve Marine" style={{width:280,objectFit:'contain'}}/>
          <div style={{height:1,background:'linear-gradient(90deg,transparent,#29ABE2,#2BB5A0,transparent)',width:'100%',marginTop:16}}/>
        </div>

        <p className="text-sm text-center mb-6" style={{color:'#808080'}}>
          Contractor availability portal — sign in with your email. Customer access is by invitation only.
        </p>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{background:'#e6f7f5'}}>
              <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="#2BB5A0" strokeWidth="2"><path d="M4 10l4 4 8-8"/></svg>
            </div>
            <p className="font-medium mb-1">Check your inbox</p>
            <p className="text-sm" style={{color:'#808080'}}>We sent a magic link to <strong>{email}</strong></p>
            <button onClick={() => setSent(false)} className="text-xs mt-4 underline" style={{color:'#29ABE2'}}>Use a different email</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="text-xs mb-1 block" style={{color:'#808080'}}>Email address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" required
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2"
              style={{'--tw-ring-color':'#29ABE2'} as any}
            />
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <button type="submit" disabled={loading || !email}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{background:'linear-gradient(90deg,#29ABE2,#2BB5A0)'}}>
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}

        <p className="text-center text-xs mt-6" style={{color:'#aaa'}}>Resolve Marine PTY LTD © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}