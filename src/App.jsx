import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Categorize from './pages/Categorize'
import MonthlyReport from './pages/MonthlyReport'
import Assets from './pages/Assets'

function App() {
  return (
    <BrowserRouter>
      <div>
        <nav style={{display: 'flex', gap: '16px', padding: '16px', borderBottom: '1px solid #eee'}}>
          <NavLink to="/">대시보드</NavLink>
          <NavLink to="/upload">카드내역 업로드</NavLink>
          <NavLink to="/categorize">카테고리 분류</NavLink>
          <NavLink to="/monthly">월별 리포트</NavLink>
          <NavLink to="/assets">자산 현황</NavLink>
        </nav>
        <main style={{padding: '24px'}}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/categorize" element={<Categorize />} />
            <Route path="/monthly" element={<MonthlyReport />} />
            <Route path="/assets" element={<Assets />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App