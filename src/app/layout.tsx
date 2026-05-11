import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resolve Marine — Contractor Roster',
  description: 'Contractor availability and enquiry platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{margin:0,padding:0,background:'#f8fafb'}}>
        <header style={{background:'#fff',borderBottom:'1px solid #e5e7eb',padding:'12px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:50}}>
          <img src="/logo.jpg" alt="Resolve Marine" style={{height:50,objectFit:'contain'}}/>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:11,color:'#808080',letterSpacing:'0.08em',textTransform:'uppercase'}}>Offshore | Energy</div>
            <div style={{fontSize:11,color:'#aaa'}}>Contractor Availability Portal</div>
          </div>
        </header>
        <main>{children}</main>
        <footer style={{borderTop:'1px solid #e5e7eb',padding:'16px 24px',textAlign:'center',fontSize:12,color:'#aaa',background:'#fff',marginTop:40}}>
          Resolve Marine PTY LTD © {new Date().getFullYear()} — Offshore | Energy
        </footer>
      </body>
    </html>
  )
}