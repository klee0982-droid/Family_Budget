import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Categorize from './pages/Categorize'
import MonthlyReport from './pages/MonthlyReport'
import Assets from './pages/Assets'
import Income from './pages/Income'
import YearlySummary from './pages/YearlySummary'
import PasswordGate from './PasswordGate'

function App() {
  return (
    <PasswordGate>
      <BrowserRouter>
        <div style={{minHeight: '100vh', background: '#f2f4f6'}}>
          <nav style={{
            background: 'white',
            borderBottom: '1px solid #e8ebed',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            height: '60px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginRight: '28px'}}>
              <div style={{
                width: '28px', height: '28px',
                background: '#3182f6',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{color: 'white', fontSize: '14px', fontWeight: '700'}}>가</span>
              </div>
              <span style={{fontWeight: '700', fontSize: '16px', color: '#191f28', letterSpacing: '-0.3px'}}>가계부</span>
            </div>

            {[
              { to: '/', label: '대시보드' },
              { to: '/upload', label: '카드내역 업로드' },
              { to: '/categorize', label: '카테고리 분류' },
              { to: '/income', label: '수입/저축/지출' },
              { to: '/monthly', label: '월별 리포트' },
              { to: '/yearly', label: '연간 결산' },
              { to: '/assets', label: '자산 현황' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '400',
                  color: isActive ? '#3182f6' : '#8b95a1',
                  background: isActive ? '#ebf3fe' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <main style={{padding: '32px 24px', maxWidth: '1000px', margin: '0 auto'}}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/categorize" element={<Categorize />} />
              <Route path="/income" element={<Income />} />
              <Route path="/monthly" element={<MonthlyReport />} />
              <Route path="/yearly" element={<YearlySummary />} />
              <Route path="/assets" element={<Assets />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </PasswordGate>
  )
}

export default App