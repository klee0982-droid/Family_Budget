import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar } from 'recharts'

function YearlySummary() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [monthlyData, setMonthlyData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [year])

  async function fetchData() {
    setLoading(true)

    const [{ data: incomes }, { data: transactions }, { data: savings }] = await Promise.all([
      supabase.from('incomes').select('month, amount').eq('year', year),
      supabase.from('transactions').select('month, amount').eq('year', year),
      supabase.from('savings').select('month, amount').eq('year', year),
    ])

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const income = (incomes || []).filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)
      const expense = (transactions || []).filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)
      const saving = (savings || []).filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)
      const savingRate = income > 0 ? ((income - expense) / income * 100) : 0
      return {
        month: `${m}월`,
        monthNum: m,
        수입: Math.round(income / 10000),
        지출: Math.round(expense / 10000),
        저축: Math.round(saving / 10000),
        저축률: parseFloat(savingRate.toFixed(1)),
        incomeRaw: income,
        expenseRaw: expense,
        savingRaw: saving,
      }
    })

    setMonthlyData(monthly)
    setLoading(false)
  }

  const totalIncome = monthlyData.reduce((s, m) => s + m.incomeRaw, 0)
  const totalExpense = monthlyData.reduce((s, m) => s + m.expenseRaw, 0)
  const totalSaving = monthlyData.reduce((s, m) => s + m.savingRaw, 0)
  const avgSavingRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0

  const activeMonths = monthlyData.filter(m => m.incomeRaw > 0 || m.expenseRaw > 0)

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>연간 결산</h2>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>
      ) : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px'}}>
            {[
              { label: '연간 수입', value: totalIncome, color: '#00b493' },
              { label: '연간 지출', value: totalExpense, color: '#f04452' },
              { label: '연간 저축', value: totalSaving, color: '#3182f6' },
              { label: '평균 저축률', value: avgSavingRate + '%', color: parseFloat(avgSavingRate) >= 0 ? '#00b493' : '#f04452', isRate: true },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="label">{item.label}</div>
                <div className="value" style={{color: item.color}}>
                  {item.isRate ? item.value : item.value.toLocaleString() + '원'}
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{marginBottom: '24px'}}>
            <h3 style={{marginBottom: '20px'}}>월별 수입 / 지출 / 저축</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{left: 8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{fontSize: 12}} />
                <YAxis tickFormatter={v => `${v}만`} tick={{fontSize: 12}} />
                <Tooltip formatter={(v, name) => [`${v.toLocaleString()}만원`, name]} />
                <Legend />
                <Bar dataKey="수입" fill="#00b493" radius={[4, 4, 0, 0]} />
                <Bar dataKey="지출" fill="#f04452" radius={[4, 4, 0, 0]} />
                <Bar dataKey="저축" fill="#3182f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{marginBottom: '24px'}}>
            <h3 style={{marginBottom: '20px'}}>월별 저축률</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{fontSize: 12}} />
                <YAxis tickFormatter={v => `${v}%`} tick={{fontSize: 12}} />
                <Tooltip formatter={v => [`${v}%`, '저축률']} />
                <Line type="monotone" dataKey="저축률" stroke="#7c3aed" strokeWidth={2.5} dot={{r: 4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{marginBottom: '16px'}}>월별 상세</h3>
            <table>
              <thead>
                <tr>
                  <th>월</th>
                  <th style={{textAlign: 'right'}}>수입</th>
                  <th style={{textAlign: 'right'}}>지출</th>
                  <th style={{textAlign: 'right'}}>저축</th>
                  <th style={{textAlign: 'right'}}>저축률</th>
                  <th style={{textAlign: 'right'}}>잉여금</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map(m => {
                  const surplus = m.incomeRaw - m.expenseRaw
                  const hasData = m.incomeRaw > 0 || m.expenseRaw > 0
                  return (
                    <tr key={m.month} style={{opacity: hasData ? 1 : 0.35}}>
                      <td style={{fontWeight: '600'}}>{m.month}</td>
                      <td style={{textAlign: 'right', color: '#00b493', fontWeight: '500'}}>
                        {hasData ? m.incomeRaw.toLocaleString() + '원' : '-'}
                      </td>
                      <td style={{textAlign: 'right', color: '#f04452', fontWeight: '500'}}>
                        {hasData ? m.expenseRaw.toLocaleString() + '원' : '-'}
                      </td>
                      <td style={{textAlign: 'right', color: '#3182f6', fontWeight: '500'}}>
                        {hasData ? m.savingRaw.toLocaleString() + '원' : '-'}
                      </td>
                      <td style={{textAlign: 'right', fontWeight: '600', color: m.저축률 >= 0 ? '#00b493' : '#f04452'}}>
                        {hasData ? m.저축률 + '%' : '-'}
                      </td>
                      <td style={{textAlign: 'right', fontWeight: '600', color: surplus >= 0 ? '#191f28' : '#f04452'}}>
                        {hasData ? (surplus >= 0 ? '+' : '') + surplus.toLocaleString() + '원' : '-'}
                      </td>
                    </tr>
                  )
                })}
                <tr style={{borderTop: '2px solid #e8ebed', fontWeight: '700'}}>
                  <td>합계</td>
                  <td style={{textAlign: 'right', color: '#00b493'}}>{totalIncome.toLocaleString()}원</td>
                  <td style={{textAlign: 'right', color: '#f04452'}}>{totalExpense.toLocaleString()}원</td>
                  <td style={{textAlign: 'right', color: '#3182f6'}}>{totalSaving.toLocaleString()}원</td>
                  <td style={{textAlign: 'right', color: parseFloat(avgSavingRate) >= 0 ? '#00b493' : '#f04452'}}>{avgSavingRate}%</td>
                  <td style={{textAlign: 'right', color: (totalIncome - totalExpense) >= 0 ? '#191f28' : '#f04452'}}>
                    {(totalIncome - totalExpense) >= 0 ? '+' : ''}{(totalIncome - totalExpense).toLocaleString()}원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default YearlySummary