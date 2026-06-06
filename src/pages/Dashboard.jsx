import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = ['#3182f6', '#00b493', '#f04452', '#ff8c00', '#7c3aed', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#eab308']

function Dashboard() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [summary, setSummary] = useState({ income: 0, expense: 0, saving: 0 })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const [{ data: incomes }, { data: transactions }, { data: savings }] = await Promise.all([
      supabase.from('incomes').select('amount').eq('year', year).eq('month', month),
      supabase.from('transactions').select('amount, category_id, categories(main_category)').eq('year', year).eq('month', month).not('category_id', 'is', null),
      supabase.from('savings').select('amount').eq('year', year).eq('month', month),
    ])

    const totalIncome = (incomes || []).reduce((s, r) => s + r.amount, 0)
    const totalExpense = (transactions || []).reduce((s, r) => s + r.amount, 0)
    const totalSaving = (savings || []).reduce((s, r) => s + r.amount, 0)
    setSummary({ income: totalIncome, expense: totalExpense, saving: totalSaving })

    const categoryMap = {}
    ;(transactions || []).forEach(t => {
      const name = t.categories?.main_category || '미분류'
      categoryMap[name] = (categoryMap[name] || 0) + t.amount
    })
    setChartData(Object.entries(categoryMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value))
    setLoading(false)
  }

  const savingRate = summary.income > 0 ? ((summary.income - summary.expense) / summary.income * 100).toFixed(1) : 0

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>대시보드</h2>
        <div style={{display: 'flex', gap: '8px'}}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>
      ) : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px'}}>
            {[
              { label: '이번 달 수입', value: summary.income, color: '#00b493' },
              { label: '이번 달 지출', value: summary.expense, color: '#f04452' },
              { label: '이번 달 저축', value: summary.saving, color: '#3182f6' },
              { label: '저축률', value: savingRate, color: savingRate >= 0 ? '#00b493' : '#f04452', isRate: true },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="label">{item.label}</div>
                <div className="value" style={{color: item.color}}>
                  {item.isRate ? `${item.value}%` : `${item.value.toLocaleString()}원`}
                </div>
              </div>
            ))}
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            <div className="card">
              <h3 style={{marginBottom: '20px', color: '#191f28'}}>카테고리별 지출</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                    >
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => v.toLocaleString() + '원'} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0', fontSize: '14px'}}>
                  분류된 지출이 없어요
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{marginBottom: '20px', color: '#191f28'}}>지출 내역</h3>
              {chartData.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                  {chartData.map((item, i) => (
                    <div key={item.name} style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div style={{width: '10px', height: '10px', borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0}} />
                      <span style={{flex: 1, fontSize: '14px', color: '#191f28'}}>{item.name}</span>
                      <span style={{fontSize: '14px', fontWeight: '600', color: '#191f28'}}>{item.value.toLocaleString()}원</span>
                      <span style={{fontSize: '12px', color: '#8b95a1', width: '36px', textAlign: 'right'}}>
                        {summary.expense > 0 ? (item.value / summary.expense * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0', fontSize: '14px'}}>
                  데이터가 없어요
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard