'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Contractor, Availability, AvailabilityStatus } from '@/types'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const SC: Record<AvailabilityStatus,string> = { available:'bg-green-100 text-green-800', partial:'bg-amber-100 text-amber-800', busy:'bg-red-100 text-red-800' }

export default function ContractorPage() {
  const supabase = createClient()
  const [contractor, setContractor] = useState<Contractor|null>(null)
  const [availability, setAvailability] = useState<Record<string,AvailabilityStatus>>({})
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const [bulkFromMonth, setBulkFromMonth] = useState(now.getMonth())
  const [bulkFromYear, setBulkFromYear] = useState(now.getFullYear())
  const [bulkToMonth, setBulkToMonth] = useState(Math.min(now.getMonth()+5,11))
  const [bulkToYear, setBulkToYear] = useState(now.getMonth()+5>11 ? now.getFullYear()+1 : now.getFullYear())
  const [bulkDays, setBulkDays] = useState<number[]>([1,2,3,4,5])
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>('available')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkMsg, setBulkMsg] = useState('')

  useEffect(() => { loadContractor() }, [])
  useEffect(() => { if (contractor) loadAvailability() }, [contractor, viewYear, viewMonth])

  async function loadContractor() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('contractors').select('*').eq('profile_id', user.id).single()
    if (data) setContractor(data)
  }

  async function loadAvailability() {
    if (!contractor) return
    const res = await fetch(`/api/availability?contractor_id=${contractor.id}&year=${viewYear}&month=${viewMonth}`)
    const rows: Availability[] = await res.json()
    const map: Record<string,AvailabilityStatus> = {}
    rows.forEach(r => { map[r.date] = r.status })
    setAvailability(prev => ({ ...prev, ...map }))
  }

  async function setDayStatus(date: string, status: AvailabilityStatus) {
    if (!contractor) return
    setSaving(true)
    await fetch('/api/availability', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ contractor_id: contractor.id, date, status }) })
    setAvailability(prev => ({ ...prev, [date]: status }))
    setSelectedDate(null); setSaving(false)
  }

  async function applyBulk() {
    if (!contractor || bulkDays.length===0) return
    setBulkLoading(true)
    const dates: string[] = []
    let y=bulkFromYear, m=bulkFromMonth
    while (y<bulkToYear || (y===bulkToYear && m<=bulkToMonth)) {
      const dim=new Date(y,m+1,0).getDate()
      for (let d=1;d<=dim;d++) {
        if (bulkDays.includes(new Date(y,m,d).getDay()))
          dates.push(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
      }
      m++; if(m>11){m=0;y++}
    }
    for (let i=0;i<dates.length;i+=50) {
      const chunk=dates.slice(i,i+50)
      await Promise.all(chunk.map(date => fetch('/api/availability',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({contractor_id:contractor!.id,date,status:bulkStatus})})))
      const upd: Record<string,AvailabilityStatus>={}
      chunk.forEach(d=>{upd[d]=bulkStatus})
      setAvailability(prev=>({...prev,...upd}))
    }
    setBulkLoading(false)
    setBulkMsg(`Done — ${dates.length} days marked as ${bulkStatus}.`)
    setTimeout(()=>setBulkMsg(''),3500)
  }

  function changeMonth(delta: number) {
    let m=viewMonth+delta, y=viewYear
    if(m>11){m=0;y++} if(m<0){m=11;y--}
    setViewMonth(m); setViewYear(y)
  }

  function buildCalendarDays() {
    const firstDay=new Date(viewYear,viewMonth,1).getDay()
    const dim=new Date(viewYear,viewMonth+1,0).getDate()
    const prev=new Date(viewYear,viewMonth,0).getDate()
    const days: {date:string|null;day:number;otherMonth:boolean}[]=[]
    for(let i=0;i<firstDay;i++) days.push({date:null,day:prev-firstDay+1+i,otherMonth:true})
    for(let d=1;d<=dim;d++){
      const date=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      days.push({date,day:d,otherMonth:false})
    }
    return days
  }

  const yearOptions=Array.from({length:3},(_,i)=>now.getFullYear()+i)
  const calDays=buildCalendarDays()
  const today=new Date().toISOString().slice(0,10)
  const prefix=`${viewYear}-${String(viewMonth+1).padStart(2,'0')}-`
  const avCount=Object.entries(availability).filter(([k,v])=>k.startsWith(prefix)&&v==='available').length
  const busyCount=Object.entries(availability).filter(([k,v])=>k.startsWith(prefix)&&v==='busy').length

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{contractor?.alias ?? 'Contractor portal'}</h1>
        {contractor && <p className="text-sm text-gray-500 mt-0.5">{contractor.specialty} — manage your availability below</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Available — {MONTHS[viewMonth]}</p><p className="text-xl font-semibold text-green-800">{avCount} days</p></div>
        <div className="bg-gray-50 rounded-lg p-3"><p className="text-xs text-gray-500 mb-1">Booked — {MONTHS[viewMonth]}</p><p className="text-xl font-semibold text-red-700">{busyCount} days</p></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-4">Bulk set availability</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[['From',bulkFromMonth,setBulkFromMonth,bulkFromYear,setBulkFromYear],['To',bulkToMonth,setBulkToMonth,bulkToYear,setBulkToYear]].map(([label,mon,setMon,yr,setYr]:any)=>(
            <div key={label}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <div className="flex gap-2">
                <select value={mon} onChange={e=>setMon(+e.target.value)} className="flex-1 border rounded-lg px-2 py-2 text-sm">
                  {MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}
                </select>
                <select value={yr} onChange={e=>setYr(+e.target.value)} className="w-24 border rounded-lg px-2 py-2 text-sm">
                  {yearOptions.map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <label className="text-xs text-gray-500 mb-2 block">Days of the week</label>
        <div className="flex gap-2 flex-wrap mb-2">
          {DAYS.map((d,i)=>(
            <button key={d} type="button" onClick={()=>setBulkDays(prev=>prev.includes(i)?prev.filter(x=>x!==i):[...prev,i])}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${bulkDays.includes(i)?'bg-blue-50 border-blue-300 text-blue-800':'border-gray-200 text-gray-400'}`}>{d}</button>
          ))}
        </div>
        <div className="flex gap-3 mb-4 text-xs">
          {[['Weekdays',[1,2,3,4,5]],['Weekends',[0,6]],['All',[0,1,2,3,4,5,6]]].map(([l,d]:any)=>(
            <button key={l} onClick={()=>setBulkDays(d)} className="text-blue-600 underline underline-offset-2 decoration-dotted">{l}</button>
          ))}
          <button onClick={()=>setBulkDays([])} className="text-gray-400 underline underline-offset-2 decoration-dotted">Clear</button>
        </div>
        <label className="text-xs text-gray-500 mb-2 block">Mark as</label>
        <div className="flex gap-2 mb-4">
          {(['available','partial','busy'] as AvailabilityStatus[]).map(s=>(
            <button key={s} type="button" onClick={()=>setBulkStatus(s)}
              className={`flex-1 py-2 rounded-lg text-sm border capitalize transition-colors ${bulkStatus===s?SC[s]+' border-transparent font-medium':'border-gray-200 text-gray-500'}`}>{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={applyBulk} disabled={bulkLoading||bulkDays.length===0} className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {bulkLoading?'Applying...':'Apply to range'}
          </button>
          {bulkMsg && <span className="text-sm text-green-700">{bulkMsg}</span>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-sm">{MONTHS[viewMonth]} {viewYear}</span>
          <div className="flex gap-2">
            <button onClick={()=>changeMonth(-1)} className="px-3 py-1 border rounded text-sm">←</button>
            <button onClick={()=>changeMonth(1)} className="px-3 py-1 border rounded text-sm">→</button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(d=><div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calDays.map((cell,i)=>{
            const status=cell.date?availability[cell.date]:undefined
            return (
              <button key={i} disabled={!cell.date||cell.otherMonth} onClick={()=>cell.date&&setSelectedDate(cell.date)}
                className={['rounded-md h-9 text-sm flex items-center justify-center border font-mono',
                  cell.otherMonth?'opacity-30 cursor-default border-transparent':'cursor-pointer',
                  status?SC[status]:'border-transparent hover:border-gray-300',
                  cell.date===today?'border-blue-400':'',
                  selectedDate===cell.date?'ring-2 ring-blue-400':''].join(' ')}>
                {cell.day}
              </button>
            )
          })}
        </div>
        {selectedDate && (
          <div className="mt-4 pt-4 border-t flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-500 font-mono">{selectedDate}</span>
            {(['available','partial','busy'] as AvailabilityStatus[]).map(s=>(
              <button key={s} disabled={saving} onClick={()=>setDayStatus(selectedDate,s)} className={`px-3 py-1 rounded text-sm border ${SC[s]} capitalize`}>{s}</button>
            ))}
            <button onClick={()=>setSelectedDate(null)} className="ml-auto text-xs text-gray-400">Cancel</button>
          </div>
        )}
        <div className="flex gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-400 inline-block"/>Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-300 inline-block"/>Booked</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-300 inline-block"/>Partial</span>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        Your profile and capability statement are managed by your account administrator.
      </div>
    </div>
  )
}
