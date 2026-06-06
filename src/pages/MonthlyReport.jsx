import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function MonthlyReport() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() === 0 ? 12 : new Date().getMonth())
  const [incomes, setIncomes] = useState([])
  const [savings, setSavings] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [openSection, setOpenSection] = useState(null) // 'income' | 'saving' | 'expense'

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

  function groupByCategory(list) {
    const map = {}
    list.forEach(item => {
      const main = item.categories?.main_category || '미분류'
      const sub = item.categories?.sub_category || '미분류'
      const key = `${main}__${sub}`
      if (!map[key]) map[key] = { main, sub, total: 0, items: [] }
      map[key].total += item.amount || 0
      map[key].items.push(item)
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  const totalIncome = incomes.reduce((s, r) => s + r.amount, 0)
  const totalExpense = transactions.reduce((s, r) => s + r.amount, 0)
  const totalSaving = savings.reduce((s, r) => s + r.amount, 0)
  const savingRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0

  const incomeGroups = groupByCategory(incomes)
  const savingGroups = groupByCategory(savings)
  const expenseGroups = groupByCategory(transactions)
  const uncategorized = transactions.filter(t => !t.category_id)

  function SectionCard({ title, total, color, groups, sectionKey, emptyText, detailRenderer }) {
    const isOpen = openSection === sectionKey
    return (
      <div className="card">
        <div
          style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isOpen ? '16px' : 0}}
          onClick={() => setOpenSection(isOpen ? null : sectionKey)}
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
                <div key={`${g.main}_${g.sub}`} style={{marginBottom: '16px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #f2f4f6'}}>
                    <div>
                      <span style={{fontSize: '14px', fontWeight: '600', color: '#191f28'}}>{g.sub}</span>
                      <span style={{fontSize: '12px', color: '#8b95a1', marginLeft: '6px'}}>{g.main}</span>
                    </div>
                    <span style={{fontSize: '14px', fontWeight: '700', color}}>{g.total.toLocaleString()}원</span>
                  </div>
                  {detailRenderer && g.items.map(item => detailRenderer(item))}
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
          {/* 요약 카드 */}
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
              ⚠ 미분류 거래 {uncategorized.length}건이 있어요. 카테고리 분류 페이지에서 분류해주세요.
            </div>
          )}

          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            {/* 수입 섹션 */}
            <SectionCard
              title="수입"
              total={totalIncome}
              color="#00b493"
              groups={incomeGroups}
              sectionKey="income"
              emptyText="수입 데이터가 없어요"
              detailRenderer={item => (
                <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 12px'}}>
                  <span style={{fontSize: '13px', color: '#8b95a1'}}>{item.memo || item.categories?.sub_category}</span>
                  <span style={{fontSize: '13px', fontWeight: '500', color: '#00b493'}}>{item.amount.toLocaleString()}원</span>
                </div>
              )}
            />

            {/* 저축 섹션 */}
            <SectionCard
              title="저축"
              total={totalSaving}
              color="#3182f6"
              groups={savingGroups}
              sectionKey="saving"
              emptyText="저축 데이터가 없어요"
              detailRenderer={item => (
                <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 12px'}}>
                  <span style={{fontSize: '13px', color: '#8b95a1'}}>{item.memo || item.categories?.sub_category}</span>
                  <span style={{fontSize: '13px', fontWeight: '500', color: '#3182f6'}}>{item.amount.toLocaleString()}원</span>
                </div>
              )}
            />

            {/* 지출 섹션 */}
            <SectionCard
              title="지출"
              total={totalExpense}
              color="#f04452"
              groups={expenseGroups}
              sectionKey="expense"
              emptyText="지출 데이터가 없어요"
              detailRenderer={item => (
                <div key={item.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0 4px 12px'}}>
                  <div>
                    <span style={{fontSize: '13px', color: '#191f28', fontWeight: '500'}}>{item.merchant}</span>
                    <span style={{fontSize: '11px', color: '#b0b8c1', marginLeft: '6px'}}>{item.date} · {item.card_type}</span>
                  </div>
                  <span style={{fontSize: '13px', fontWeight: '500', color: '#f04452'}}>{item.amount.toLocaleString()}원</span>
                </div>
              )}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyReport