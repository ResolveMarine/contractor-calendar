'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Contractor, Availability, AvailabilityStatus, CreateEnquiryInput } from '@/types'

const MONTHS_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL=['January','February','March','April','May','June','July','August','September','October','November','December']
const SPECIALTIES=['All specialties','OVID Inspector','Condition and Suitability Inspections','Marine Operation Manager or Superintendent','Subsea','Subsea Crane','ROV Operations','ROV Compliance','Offshore Client Representative','Impartial Marine Representation','Marine Casualty','High Risk Training - Offshore (RIIWHS202E/MSMWHS2127/RIIWHS204E/HLTAID011/HLTAID015/UETDRMP018/MSMSS00017)','Network Storm Testing']
const SC=(s?: AvailabilityStatus)=>s==='available'?'#4ade80':s==='partial'?'#fbbf24':s==='busy'?'#f87171':'#e5e7eb'

function buildMonths(n: number){
  const now=new Date()
  return Array.from({length:n},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()+i,1);return{year:d.getFullYear(),month:d.getMonth()}})
}

export default function CustomerPage(){
  const supabase=createClient()
  const [contractors,setContractors]=useState<Contractor[]>([])
  const [availability,setAvailability]=useState<Record<string,Record<string,AvailabilityStatus>>>({})
  const [filter,setFilter]=useState('All specialties')
  const [horizon,setHorizon]=useState(6)
  const [viewMode,setViewMode]=useState<'timeline'|'cards'>('timeline')
  const [enquiryTarget,setEnquiryTarget]=useState<Contractor|null>(null)
  const [enqStartDate,setEnqStartDate]=useState('')
  const [enqEndDate,setEnqEndDate]=useState('')
  const [enqDuration,setEnqDuration]=useState('')
  const [enqMsg,setEnqMsg]=useState('')
  const [enqName,setEnqName]=useState('')
  const [enqSent,setEnqSent]=useState(false)
  const [submitting,setSubmitting]=useState(false)

  const months=buildMonths(horizon)

  useEffect(()=>{loadContractors()},[])
  useEffect(()=>{contractors.forEach(c=>loadAvailRange(c.id))},[horizon])

  async function loadContractors(){
    const {data}=await supabase.from('contractors').select('*').eq('active',true).order('alias')
    if(data){setContractors(data);data.forEach((c:Contractor)=>loadAvailRange(c.id))}
  }

  async function loadAvailRange(contractorId: string){
    const results=await Promise.all(months.map(({year,month})=>
      fetch(`/api/availability?contractor_id=${contractorId}&year=${year}&month=${month}`).then(r=>r.json() as Promise<Availability[]>)
    ))
    const map: Record<string,AvailabilityStatus>={}
    results.flat().forEach(r=>{map[r.date]=r.status})
    setAvailability(prev=>({...prev,[contractorId]:map}))
  }

  async function submitEnquiry(){
    if(!enquiryTarget||!enqMsg.trim())return
    setSubmitting(true)
    let datesStr=''
    if(enqStartDate&&enqEndDate) datesStr=`${enqStartDate} to ${enqEndDate}`
    else if(enqStartDate&&enqDuration) datesStr=`From ${enqStartDate}, approx. ${enqDuration} weeks`
    else if(enqStartDate) datesStr=`From ${enqStartDate}`
    const body: CreateEnquiryInput={contractor_id:enquiryTarget.id,preferred_dates:datesStr||undefined,message:enqMsg,contact_name:enqName||undefined}
    const res=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
    setSubmitting(false)
    if(res.ok){setEnqSent(true);setTimeout(()=>{setEnquiryTarget(null);setEnqSent(false);setEnqStartDate('');setEnqEndDate('');setEnqDuration('');setEnqMsg('');setEnqName('')},2000)}
  }

  function calcWeeks(){
    if(enqStartDate&&enqEndDate&&enqEndDate>=enqStartDate)
      return Math.ceil((new Date(enqEndDate).getTime()-new Date(enqStartDate).getTime())/(1000*60*60*24*7))
    return null
  }

  function avInMonth(cid: string,y: number,m: number){
    const map=availability[cid]??{}
    const prefix=`${y}-${String(m+1).padStart(2,'0')}-`
    return Object.entries(map).filter(([k,v])=>k.startsWith(prefix)&&v==='available').length
  }

  function miniStrip(cid: string,year: number,month: number){
    const dim=new Date(year,month+1,0).getDate()
    const map=availability[cid]??{}
    return Array.from({length:dim},(_,i)=>{
      const date=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
      return <div key={i} style={{height:7,borderRadius:1,background:SC(map[date])}}/>
    })
  }

  const filtered=filter==='All specialties'?contractors:contractors.filter(c=>c.specialty===filter)

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div><h1 className="text-xl font-semibold mb-1">Available contractors</h1><p className="text-sm text-gray-500">Next {horizon} months</p></div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {[3,6,12,24].map(n=><button key={n} onClick={()=>setHorizon(n)} className={`px-3 py-1.5 ${horizon===n?'bg-blue-500 text-white':'text-gray-500 hover:bg-gray-50'}`}>{n}m</button>)}
          </div>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button onClick={()=>setViewMode('timeline')} className={`px-3 py-1.5 ${viewMode==='timeline'?'bg-blue-500 text-white':'text-gray-500'}`}>Timeline</button>
            <button onClick={()=>setViewMode('cards')} className={`px-3 py-1.5 ${viewMode==='cards'?'bg-blue-500 text-white':'text-gray-500'}`}>Cards</button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {SPECIALTIES.map(s=><button key={s} onClick={()=>setFilter(s)} className={`px-3 py-1 rounded-full text-xs border transition-colors ${filter===s?'bg-blue-50 border-blue-300 text-blue-800':'border-gray-200 text-gray-500 hover:border-gray-400'}`}>{s}</button>)}
      </div>

      {viewMode==='timeline' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="border-collapse w-full" style={{minWidth:480}}>
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border-b border-gray-100 w-40">Contractor</th>
                  {months.map(({year,month})=><th key={`${year}-${month}`} className="px-2 py-2 text-center text-xs font-medium text-gray-500 bg-gray-50 border-b border-l border-gray-100 whitespace-nowrap">{MONTHS_SHORT[month]}<span className="block text-gray-400 font-normal text-xs">{year}</span></th>)}
                  <th className="border-b border-l border-gray-100 bg-gray-50 w-20"/>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c,ci)=>(
                  <tr key={c.id} className="hover:bg-gray-50 group">
                    <td className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">{c.alias.slice(-2)}</div>
                        <div><div className="text-xs font-medium truncate max-w-24">{c.alias}</div><div className="text-xs text-gray-400 truncate max-w-24">{c.specialty}</div></div>
                      </div>
                    </td>
                    {months.map(({year,month})=>{
                      const dim=new Date(year,month+1,0).getDate()
                      const map=availability[c.id]??{}
                      const av=avInMonth(c.id,year,month)
                      const cells=Array.from({length:dim},(_,i)=>{
                        const date=`${year}-${String(month+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
                        return <div key={i} style={{height:9,borderRadius:1,background:SC(map[date])}}/>
                      })
                      const cls=av>15?'text-green-700':av>7?'text-amber-700':av>0?'text-red-600':'text-gray-300'
                      return <td key={`${year}-${month}`} className="px-1 py-2 border-b border-l border-gray-100">
                        <div style={{display:'grid',gridTemplateColumns:`repeat(${dim},1fr)`,gap:1,marginBottom:2}}>{cells}</div>
                        <div className={`text-center text-xs font-mono font-medium ${cls}`}>{av>0?`${av}d`:'—'}</div>
                      </td>
                    })}
                    <td className="px-2 border-b border-l border-gray-100">
                      <button onClick={()=>{setEnquiryTarget(c);setEnqSent(false)}} className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium whitespace-nowrap">Enquire</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 px-4 py-2 border-t border-gray-100 bg-gray-50">
            {[['#4ade80','Available'],['#fbbf24','Partial'],['#f87171','Busy'],['#e5e7eb','No data']].map(([col,label])=>(
              <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span style={{width:10,height:10,borderRadius:2,background:col,display:'inline-block'}}/>{label}
              </span>
            ))}
          </div>
        </div>
      )}

      {viewMode==='cards' && filtered.map((c,ci)=>{
        const totalAv=months.reduce((a,{year,month})=>a+avInMonth(c.id,year,month),0)
        const cols=Math.min(horizon,6)
        return (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-800 flex items-center justify-center text-sm font-semibold flex-shrink-0">{c.alias.slice(-2)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm">{c.alias}</span>
                  <span className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded">{c.specialty}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${totalAv>40?'bg-green-100 text-green-800':totalAv>15?'bg-amber-100 text-amber-800':'bg-red-100 text-red-800'}`}>{totalAv} days free / {horizon}m</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{c.cv_summary}</p>
                <div className="flex gap-1 flex-wrap">{c.skills?.slice(0,4).map(s=><span key={s} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s}</span>)}</div>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:10,marginBottom:12}}>
              {months.slice(0,Math.min(horizon,12)).map(({year,month})=>(
                <div key={`${year}-${month}`}>
                  <div className="text-xs text-gray-400 mb-1">{MONTHS_SHORT[month]}{year!==new Date().getFullYear()?` ${year}`:''}</div>
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${new Date(year,month+1,0).getDate()},1fr)`,gap:1}}>{miniStrip(c.id,year,month)}</div>
                  <div className={`text-xs mt-0.5 font-mono ${avInMonth(c.id,year,month)>10?'text-green-700':avInMonth(c.id,year,month)>0?'text-amber-700':'text-gray-300'}`}>{avInMonth(c.id,year,month)>0?`${avInMonth(c.id,year,month)}d`:'—'}</div>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
              {c.capability_file_url
                ? <a href={c.capability_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-green-700 border border-green-200 bg-green-50 px-3 py-1.5 rounded-lg">
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z"/></svg>
                    Download capability statement
                  </a>
                : <span className="text-xs text-gray-400">Capability statement pending</span>
              }
              <button onClick={()=>{setEnquiryTarget(c);setEnqSent(false)}} className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium">Send enquiry</button>
            </div>
          </div>
        )
      })}

      {enquiryTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            {enqSent ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="22" height="22" viewBox="0 0 20 20" fill="#166534"><path d="M16.707 5.293a1 1 0 0 0-1.414 0L8 12.586 4.707 9.293a1 1 0 0 0-1.414 1.414l4 4a1 1 0 0 0 1.414 0l8-8a1 1 0 0 0 0-1.414z"/></svg>
                </div>
                <p className="font-semibold mb-1">Enquiry sent</p>
                <p className="text-sm text-gray-500">We'll be in touch shortly.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div><h2 className="font-semibold">Enquire about {enquiryTarget.alias}</h2><p className="text-xs text-gray-400 mt-0.5">{enquiryTarget.specialty}</p></div>
                  <button onClick={()=>setEnquiryTarget(null)} className="text-gray-400 text-lg leading-none">✕</button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Engagement dates</p>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="text-xs text-gray-500 mb-1 block">Start date</label><input type="date" value={enqStartDate} onChange={e=>setEnqStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm bg-white"/></div>
                    <div><label className="text-xs text-gray-500 mb-1 block">End date (if known)</label><input type="date" value={enqEndDate} onChange={e=>setEnqEndDate(e.target.value)} min={enqStartDate} className="w-full border rounded-lg px-3 py-2 text-sm bg-white"/></div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">{calcWeeks()?'Duration (calculated)':'Estimated duration'}</label>
                    {calcWeeks()
                      ? <div className="border rounded-lg px-3 py-2 text-sm bg-white font-mono">{calcWeeks()} weeks</div>
                      : <div className="flex items-center gap-2"><input type="number" value={enqDuration} onChange={e=>setEnqDuration(e.target.value)} placeholder="e.g. 12" min="1" max="104" className="w-24 border rounded-lg px-3 py-2 text-sm"/><span className="text-sm text-gray-500">weeks</span></div>
                    }
                  </div>
                </div>
                <div className="mb-3"><label className="text-xs text-gray-500 mb-1 block">Project / scope details *</label><textarea value={enqMsg} onChange={e=>setEnqMsg(e.target.value)} placeholder="Brief description of the engagement..." rows={3} className="w-full border rounded-lg px-3 py-2 text-sm resize-none"/></div>
                <div className="mb-4"><label className="text-xs text-gray-500 mb-1 block">Your name and role</label><input value={enqName} onChange={e=>setEnqName(e.target.value)} placeholder="Name and role" className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
                <div className="flex gap-2">
                  <button onClick={submitEnquiry} disabled={submitting||!enqMsg.trim()} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">{submitting?'Sending...':'Submit enquiry'}</button>
                  <button onClick={()=>setEnquiryTarget(null)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
