import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const COLORS = ['#4f46e5', '#7c3aed', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6']

function Dashboard() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [summary, setSummary] = useState({ income: 0, expense: 0, saving: 0 })
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [year, month])

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

    // 카테고리별 지출 집계
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
    <div style={{maxWidth: '900px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
        <h2 style={{margin: 0}}>대시보드</h2>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>

      {loading ? <div>불러오는 중...</div> : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px'}}>
            {[
              { label: '수입', value: summary.income, color: '#22c55e' },
              { label: '지출', value: summary.expense, color: '#f43f5e' },
              { label: '저축', value: summary.saving, color: '#3b82f6' },
              { label: '저축률', value: savingRate + '%', color: '#4f46e5', isRate: true },
            ].map(item => (
              <div key={item.label} style={{background: '#f9fafb', borderRadius: '8px', padding: '16px'}}>
                <div style={{fontSize: '13px', color: '#666', marginBottom: '8px'}}>{item.label}</div>
                <div style={{fontSize: '20px', fontWeight: '600', color: item.color}}>
                  {item.isRate ? item.value : item.value.toLocaleString() + '원'}
                </div>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div>
              <h3 style={{fontSize: '15px', marginBottom: '16px'}}>카테고리별 지출</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => v.toLocaleString() + '원'} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartData.length === 0 && (
            <p style={{color: '#666'}}>이번 달 카테고리 분류된 지출이 없어요.</p>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard