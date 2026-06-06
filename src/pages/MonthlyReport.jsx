import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const defaultMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth()
const defaultYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()

function MonthlyReport() {
  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)
  const [incomes, setIncomes] = useState([])
  const [savings, setSavings] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [openSections, setOpenSections] = useState(new Set())

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const [{ data: inc }, { data: sav }, { data: tx }] = await Promise.all([
      supabase.from('incomes').select('*, categories(main_category, sub_category)').eq('year', year).eq('month', month),
      supabase.from('savings').select('*, categories(main_category, sub_category)').eq('year', year).eq('month', month),
      supabase.from('transactions').select('*, categories(main_category, sub_category)').eq('year', year).eq('month', month).order('date', { ascending: false }),
    ])
    setIncomes(inc || [])
    setSavings(sav || [])
    setTransactions(tx || [])
    setLoading(false)
  }

  function toggleSection(key) {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // 대분류로 먼저 묶고, 그 안에 소분류별로 합산
  function groupByMain(list) {
    const mainMap = {}
    list.forEach(item => {
      const main = item.categories?.main_category || '미분류'
      const sub = item.categories?.sub_category || '미분류'
      if (!mainMap[main]) mainMap[main] = { main, total: 0, subs: {} }
      mainMap[main].total += item.amount || 0
      if (!mainMap[main].subs[sub]) mainMap[main].subs[sub] = { sub, total: 0, items: [] }
      mainMap[main].subs[sub].total += item.amount || 0
      mainMap[main].subs[sub].items.push(item)
    })
    return Object.values(mainMap)
      .sort((a, b) => b.total - a.total)
      .map(g => ({ ...g, subs: Object.values(g.subs).sort((a, b) => b.total - a.total) }))
  }

  const totalIncome = incomes.reduce((s, r) => s + r.amount, 0)
  const totalExpense = transactions.reduce((s, r) => s + r.amount, 0)
  const totalSaving = savings.reduce((s, r) => s + r.amount, 0)
  const savingRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0

  const incomeGroups = groupByMain(incomes)
  const savingGroups = groupByMain(savings)
  const expenseGroups = groupByMain(transactions)
  const uncategorized = transactions.filter(t => !t.category_id)

  function SectionCard({ title, total, color, groups, sectionKey, emptyText }) {
    const isOpen = openSections.has(sectionKey)
    return (
      <div className="card">
        <div
          style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isOpen ? '16px' : 0}}
          onClick={() => toggleSection(sectionKey)}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
            <h3>{title}</h3>
            <span style={{fontSize: '16px', fontWeight: '700', color}}>{total.toLocaleString()}원</span>
          </div>
          <span style={{fontSize: '13px', color: '#8b95a1'}}>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
        </div>

        {isOpen && (
          groups.length === 0 ? (
            <p style={{fontSize: '13px', color: '#b0b8c1', textAlign: 'center', padding: '16px 0'}}>{emptyText}</p>
          ) : (
            <div>
              {groups.map(g => (
                <div key={g.main} style={{marginBottom: '12px'}}>
                  {/* 대분류 행 */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    marginBottom: '4px',
                  }}>
                    <span style={{fontSize: '14px', fontWeight: '600', color: '#191f28'}}>{g.main}</span>
                    <span style={{fontSize: '14px', fontWeight: '700', color}}>{g.total.toLocaleString()}원</span>
                  </div>
                  {/* 소분류 행 */}
                  {g.subs.length > 1 || (g.subs.length === 1 && g.subs[0].sub !== g.main) ? (
                    g.subs.map(s => (
                      <div key={s.sub} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '5px 10px 5px 20px',
                        borderBottom: '1px solid #f2f4f6',
                      }}>
                        <span style={{fontSize: '13px', color: '#8b95a1'}}>{s.sub}</span>
                        <span style={{fontSize: '13px', fontWeight: '500', color: '#191f28'}}>{s.total.toLocaleString()}원</span>
                      </div>
                    ))
                  ) : null}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>월별 리포트</h2>
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
              { label: '수입', value: totalIncome, color: '#00b493' },
              { label: '지출', value: totalExpense, color: '#f04452' },
              { label: '저축', value: totalSaving, color: '#3182f6' },
              { label: '저축률', value: savingRate + '%', color: parseFloat(savingRate) >= 0 ? '#00b493' : '#f04452', isRate: true },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="label">{item.label}</div>
                <div className="value" style={{color: item.color}}>
                  {item.isRate ? item.value : item.value.toLocaleString() + '원'}
                </div>
              </div>
            ))}
          </div>

          {uncategorized.length > 0 && (
            <div style={{background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#ff8c00', fontWeight: '500'}}>
              ⚠ 미분류 거래 {uncategorized.length}건이 있어요. 수입/저축/지출 페이지에서 분류해주세요.
            </div>
          )}

          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <SectionCard title="수입" total={totalIncome} color="#00b493" groups={incomeGroups} sectionKey="income" emptyText="수입 데이터가 없어요" />
            <SectionCard title="저축" total={totalSaving} color="#3182f6" groups={savingGroups} sectionKey="saving" emptyText="저축 데이터가 없어요" />
            <SectionCard title="지출" total={totalExpense} color="#f04452" groups={expenseGroups} sectionKey="expense" emptyText="지출 데이터가 없어요" />
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyReport