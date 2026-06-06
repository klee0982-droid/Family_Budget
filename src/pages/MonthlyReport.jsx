import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#4f46e5', '#7c3aed', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6']

function MonthlyReport() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [transactions, setTransactions] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [year, month])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(main_category, sub_category)')
      .eq('year', year)
      .eq('month', month)
      .order('date', { ascending: false })

    const txList = data || []
    setTransactions(txList)

    // 카테고리별 집계
    const categoryMap = {}
    txList.filter(t => t.category_id).forEach(t => {
      const name = t.categories?.main_category || '미분류'
      categoryMap[name] = (categoryMap[name] || 0) + t.amount
    })
    setChartData(
      Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    )

    setLoading(false)
  }

  const totalExpense = transactions.reduce((s, t) => s + t.amount, 0)
  const uncategorized = transactions.filter(t => !t.category_id)

  return (
    <div style={{maxWidth: '900px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
        <h2 style={{margin: 0}}>월별 리포트</h2>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>

      {loading ? <div>불러오는 중...</div> : (
        <>
          <div style={{background: '#f9fafb', borderRadius: '8px', padding: '16px', marginBottom: '24px', display: 'inline-block'}}>
            <div style={{fontSize: '13px', color: '#666', marginBottom: '4px'}}>총 지출</div>
            <div style={{fontSize: '24px', fontWeight: '600', color: '#f43f5e'}}>{totalExpense.toLocaleString()}원</div>
          </div>

          {uncategorized.length > 0 && (
            <div style={{background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', marginBottom: '24px'}}>
              <span style={{color: '#ea580c', fontSize: '14px'}}>⚠ 미분류 거래 {uncategorized.length}건이 있어요. 카테고리 분류 페이지에서 분류해주세요.</span>
            </div>
          )}

          {chartData.length > 0 && (
            <div style={{marginBottom: '32px'}}>
              <h3 style={{fontSize: '15px', marginBottom: '16px'}}>카테고리별 지출</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} layout="vertical" margin={{left: 20}}>
                  <XAxis type="number" tickFormatter={v => (v / 10000).toFixed(0) + '만'} />
                  <YAxis type="category" dataKey="name" width={70} tick={{fontSize: 13}} />
                  <Tooltip formatter={v => v.toLocaleString() + '원'} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <h3 style={{fontSize: '15px', marginBottom: '16px'}}>전체 거래 내역</h3>
            <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
              <thead>
                <tr style={{borderBottom: '2px solid #eee'}}>
                  <th style={{padding: '8px', textAlign: 'left'}}>날짜</th>
                  <th style={{padding: '8px', textAlign: 'left'}}>가맹점</th>
                  <th style={{padding: '8px', textAlign: 'left'}}>카테고리</th>
                  <th style={{padding: '8px', textAlign: 'right'}}>금액</th>
                  <th style={{padding: '8px', textAlign: 'center'}}>카드</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} style={{borderBottom: '1px solid #f0f0f0'}}>
                    <td style={{padding: '8px'}}>{t.date}</td>
                    <td style={{padding: '8px'}}>{t.merchant}</td>
                    <td style={{padding: '8px', color: t.category_id ? '#333' : '#f97316'}}>
                      {t.categories ? `${t.categories.main_category} > ${t.categories.sub_category}` : '미분류'}
                    </td>
                    <td style={{padding: '8px', textAlign: 'right'}}>{t.amount.toLocaleString()}원</td>
                    <td style={{padding: '8px', textAlign: 'center'}}>{t.card_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyReport