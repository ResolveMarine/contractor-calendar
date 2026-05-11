'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { CustomerInvite, Enquiry, Contractor, InviteStatus, EnquiryStatus } from '@/types'

const SPECIALTIES = ['OVID Inspector','Condition and Suitability Inspections','Marine Operation Manager or Superintendent','Subsea','Subsea Crane','ROV Operations','ROV Compliance','Offshore Client Representative','Impartial Marine Representation','Marine Casualty','High Risk Training - Offshore (RIIWHS202E/MSMWHS2127/RIIWHS204E/HLTAID011/HLTAID015/UETDRMP018/MSMSS00017)','Network Storm Testing']

export default function AdminPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<AdminTab>('overview')
  const [invites, setInvites] = useState<CustomerInvite[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteCompany, setInviteCompany] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editAlias, setEditAlias] = useState('')
  const [editSpec, setEditSpec] = useState('')
  const [editCv, setEditCv] = useState('')
  const [editSkills, setEditSkills] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [capFiles, setCapFiles] = useState<Record<string,string>>({})
  const [uploadingId, setUploadingId] = useState<string|null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [invRes, enqRes, conRes] = await Promise.all([
      fetch('/api/customers/invite'),
      fetch('/api/enquiries'),
      supabase.from('contractors').select('*').eq('active', true).order('alias'),
    ])
    if (invRes.ok) setInvites(await invRes.json())
    if (enqRes.ok) setEnquiries(await enqRes.json())
    if (!conRes.error && conRes.data) {
      setContractors(conRes.data)
      conRes.data.forEach((c: Contractor) => {
        if (c.capability_file_url) setCapFiles(prev => ({ ...prev, [c.id]: c.capability_file_url! }))
      })
    }
  }

  async function sendInvite() {
    if (!inviteEmail || !inviteCompany) return
    const res = await fetch('/api/customers/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, company: inviteCompany }),
    })
    if (res.ok) {
      setInviteEmail(''); setInviteCompany('')
      setInviteMsg('Invite sent.'); setTimeout(() => setInviteMsg(''), 3000)
      loadAll()
    }
  }

  async function revokeInvite(id: string) {
    await fetch('/api/customers/invite', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadAll()
  }

  async function markRead(id: string) {
    await fetch('/api/enquiries', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: 'read' }) })
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status: 'read' as EnquiryStatus } : e))
  }

  function startEdit(c: Contractor) {
    setEditingId(c.id); setEditAlias(c.alias); setEditSpec(c.specialty)
    setEditCv(c.cv_summary ?? ''); setEditSkills(c.skills?.join(', ') ?? ''); setProfileMsg('')
  }

  async function saveProfile() {
    if (!editingId) return
    await supabase.from('contractors').update({
      alias: editAlias, specialty: editSpec, cv_summary: editCv,
      skills: editSkills.split(',').map(s => s.trim()).filter(Boolean),
    }).eq('id', editingId)
    setProfileMsg('Saved.'); setTimeout(() => setProfileMsg(''), 2000)
    setContractors(prev => prev.map(c => c.id === editingId ? { ...c, alias: editAlias, specialty: editSpec, cv_summary: editCv, skills: editSkills.split(',').map(s=>s.trim()).filter(Boolean) } : c))
  }

  async function handleUpload(contractorId: string, file: File) {
    setUploadingId(contractorId)
    const ext = file.name.split('.').pop()
    const path = `${contractorId}/capability.${ext}`
    const { error } = await supabase.storage.from('capabilities').upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { data: urlData } = supabase.storage.from('capabilities').getPublicUrl(path)
      setCapFiles(prev => ({ ...prev, [contractorId]: urlData.publicUrl }))
      await supabase.from('contractors').update({ capability_file_url: urlData.publicUrl }).eq('id', contractorId)
    }
    setUploadingId(null)
  }

  async function removeCapFile(contractorId: string) {
    const url = capFiles[contractorId]
    const ext = url?.split('.').pop()
    await supabase.storage.from('capabilities').remove([`${contractorId}/capability.${ext}`])
    await supabase.from('contractors').update({ capability_file_url: null }).eq('id', contractorId)
    setCapFiles(prev => { const n = {...prev}; delete n[contractorId]; return n })
  }

  const statusBadge: Record<InviteStatus, string> = {
    pending: 'bg-amber-100 text-amber-800', active: 'bg-green-100 text-green-800', revoked: 'bg-red-100 text-red-800'
  }
  const newEnq = enquiries.filter(e => e.status === 'new').length

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-5">Admin dashboard</h1>

      <div className="flex gap-0 border-b border-gray-200 mb-6">
        {([['overview','Overview'],['contractors','Contractors'],['customers','Customers'],['enquiries',`Enquiries${newEnq ? ` (${newEnq})` : ''}`]] as [AdminTab,string][]).map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab===id ? 'border-blue-500 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-3">
          {[['Contractors', contractors.length],['Customers', invites.filter(i=>i.status==='active').length],['New enquiries', newEnq]].map(([l,v]) => (
            <div key={l as string} className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className="text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'contractors' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">You control all profile content. Contractors only update their availability.</p>
          {contractors.map(c => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center text-xs font-semibold">{c.alias.slice(-2).toUpperCase()}</div>
                <div className="flex-1"><p className="text-sm font-medium">{c.alias}</p><p className="text-xs text-gray-400">{c.specialty}</p></div>
                <button onClick={() => editingId===c.id ? setEditingId(null) : startEdit(c)} className="text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  {editingId===c.id ? 'Close' : 'Edit profile'}
                </button>
              </div>

              {editingId === c.id && (
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="text-xs text-gray-500 mb-1 block">Display alias</label><input value={editAlias} onChange={e=>setEditAlias(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white"/></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">Specialty</label>
                      <select value={editSpec} onChange={e=>setEditSpec(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                        {SPECIALTIES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3"><label className="text-xs text-gray-500 mb-1 block">Bio / CV summary (no employer names)</label><textarea value={editCv} onChange={e=>setEditCv(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm bg-white resize-none"/></div>
                  <div className="mb-3"><label className="text-xs text-gray-500 mb-1 block">Skills (comma separated)</label><input value={editSkills} onChange={e=>setEditSkills(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white"/></div>
                  <div className="flex items-center gap-3">
                    <button onClick={saveProfile} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Save profile</button>
                    {profileMsg && <span className="text-sm text-green-700">{profileMsg}</span>}
                  </div>
                </div>
              )}

              <div className="p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-3">Capability statement</p>
                {capFiles[c.id]
                  ? <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                      <span className="text-sm text-green-800 font-medium flex-1">File uploaded</span>
                      <a href={capFiles[c.id]} target="_blank" rel="noreferrer" className="text-xs text-green-700 underline">View</a>
                      <button onClick={() => removeCapFile(c.id)} className="text-xs text-red-600">Remove</button>
                    </div>
                  : <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg mb-3 text-center"><p className="text-xs text-gray-400">No file uploaded yet</p></div>
                }
                <label className={uploadingId===c.id ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}>
                  <span className="text-xs border border-gray-300 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 inline-block">
                    {uploadingId===c.id ? 'Uploading...' : capFiles[c.id] ? 'Replace file' : 'Upload file'}
                  </span>
                  <input type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={e => { const f=e.target.files?.[0]; if(f) handleUpload(c.id,f); e.target.value='' }}/>
                </label>
                <span className="text-xs text-gray-400 ml-2">PDF or Word</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'customers' && (
        <div>
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-3">Active accounts</p>
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">{inv.company.slice(0,2).toUpperCase()}</div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{inv.company}</p><p className="text-xs text-gray-400">{inv.email}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadge[inv.status]}`}>{inv.status}</span>
                {inv.status !== 'revoked' && <button onClick={() => revokeInvite(inv.id)} className="text-xs text-red-600 border border-red-200 bg-red-50 px-2 py-0.5 rounded">Revoke</button>}
              </div>
            ))}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-3">Invite new customer</p>
            <div className="flex gap-2 mb-2 flex-wrap">
              <div className="flex-1 min-w-36"><label className="text-xs text-gray-400 mb-1 block">Email</label><input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="client@company.com" className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div className="flex-1 min-w-36"><label className="text-xs text-gray-400 mb-1 block">Company</label><input value={inviteCompany} onChange={e=>setInviteCompany(e.target.value)} placeholder="Company name" className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div className="flex items-end"><button onClick={sendInvite} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Send invite</button></div>
            </div>
            {inviteMsg && <p className="text-xs text-green-700">{inviteMsg}</p>}
          </div>
        </div>
      )}

      {tab === 'enquiries' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-3">Enquiries inbox</p>
          {enquiries.length === 0 && <p className="text-sm text-gray-400">No enquiries yet.</p>}
          {enquiries.map(e => (
            <div key={e.id} className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-medium">{(e.customer as any)?.company ?? 'Customer'}</span>
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">{(e.contractor as any)?.alias ?? '—'}</span>
                  {e.status === 'new' && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">new</span>}
                </div>
                <p className="text-xs text-gray-600 mb-0.5">{e.preferred_dates && <strong>{e.preferred_dates} — </strong>}{e.message}</p>
                <p className="text-xs text-gray-400">from {e.contact_name ?? '—'}</p>
              </div>
              {e.status === 'new' && <button onClick={() => markRead(e.id)} className="text-xs border border-gray-200 px-2 py-1 rounded flex-shrink-0">Mark read</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
