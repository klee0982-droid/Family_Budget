import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function MonthlyReport() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [incomes, setIncomes] = useState([])
  const [savings, setSavings] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTransactions, setShowTransactions] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const [{ data: inc }, { data: sav }, { data: tx }, { data: cats }] = await Promise.all([
      supabase.from('incomes').select('*, categories(main_category, sub_category)').eq('year', year).eq('month', month),
      supabase.from('savings').select('*, categories(main_category, sub_category)').eq('year', year).eq('month', month),
      supabase.from('transactions').select('*, categories(main_category, sub_category)').eq('year', year).eq('month', month).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('type', 'expense').order('sort_order'),
    ])
    setIncomes(inc || [])
    setSavings(sav || [])
    setTransactions(tx || [])
    setCategories(cats || [])
    setLoading(false)
  }

  // 카테고리별 지출 합산
  function groupByCategory(list, nameKey) {
    const map = {}
    list.forEach(item => {
      const main = item.categories?.main_category || '미분류'
      const sub = item.categories?.sub_category || '미분류'
      const key = `${main}__${sub}`
      if (!map[key]) map[key] = { main, sub, total: 0 }
      map[key].total += item[nameKey] || item.amount || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  const totalIncome = incomes.reduce((s, r) => s + r.amount, 0)
  const totalExpense = transactions.reduce((s, r) => s + r.amount, 0)
  const totalSaving = savings.reduce((s, r) => s + r.amount, 0)
  const savingRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0

  const incomeGroups = groupByCategory(incomes, 'amount')
  const savingGroups = groupByCategory(savings, 'amount')
  const expenseGroups = groupByCategory(transactions, 'amount')

  const uncategorized = transactions.filter(t => !t.category_id)

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  const selectedMain = categories.find(c => c.id === editForm.category_id)?.main_category || ''

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({ date: t.date, merchant: t.merchant, amount: t.amount, category_id: t.category_id || '', card_type: t.card_type || '' })
  }

  async function handleSaveEdit(id) {
    setSaving(true)
    const [yr, mo] = editForm.date.split('-')
    await supabase.from('transactions').update({
      date: editForm.date, merchant: editForm.merchant,
      amount: parseInt(editForm.amount), category_id: editForm.category_id || null,
      card_type: editForm.card_type, year: parseInt(yr), month: parseInt(mo),
    }).eq('id', id)
    setEditingId(null)
    await fetchData()
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('삭제할까요?')) return
    await supabase.from('transactions').delete().eq('id', id)
    await fetchData()
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

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px'}}>
            {/* 수입 */}
            <div className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>수입</h3>
                <span style={{fontSize: '14px', fontWeight: '700', color: '#00b493'}}>{totalIncome.toLocaleString()}원</span>
              </div>
              {incomeGroups.length === 0 ? (
                <p style={{fontSize: '13px', color: '#b0b8c1', textAlign: 'center', padding: '16px 0'}}>데이터 없음</p>
              ) : incomeGroups.map(g => (
                <div key={`${g.main}_${g.sub}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <div>
                    <div style={{fontSize: '13px', fontWeight: '500', color: '#191f28'}}>{g.sub}</div>
                    <div style={{fontSize: '11px', color: '#8b95a1'}}>{g.main}</div>
                  </div>
                  <span style={{fontSize: '13px', fontWeight: '600', color: '#00b493'}}>{g.total.toLocaleString()}원</span>
                </div>
              ))}
            </div>

            {/* 저축 */}
            <div className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>저축</h3>
                <span style={{fontSize: '14px', fontWeight: '700', color: '#3182f6'}}>{totalSaving.toLocaleString()}원</span>
              </div>
              {savingGroups.length === 0 ? (
                <p style={{fontSize: '13px', color: '#b0b8c1', textAlign: 'center', padding: '16px 0'}}>데이터 없음</p>
              ) : savingGroups.map(g => (
                <div key={`${g.main}_${g.sub}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <div>
                    <div style={{fontSize: '13px', fontWeight: '500', color: '#191f28'}}>{g.sub}</div>
                    <div style={{fontSize: '11px', color: '#8b95a1'}}>{g.main}</div>
                  </div>
                  <span style={{fontSize: '13px', fontWeight: '600', color: '#3182f6'}}>{g.total.toLocaleString()}원</span>
                </div>
              ))}
            </div>

            {/* 지출 */}
            <div className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>지출</h3>
                <span style={{fontSize: '14px', fontWeight: '700', color: '#f04452'}}>{totalExpense.toLocaleString()}원</span>
              </div>
              {expenseGroups.length === 0 ? (
                <p style={{fontSize: '13px', color: '#b0b8c1', textAlign: 'center', padding: '16px 0'}}>데이터 없음</p>
              ) : expenseGroups.map(g => (
                <div key={`${g.main}_${g.sub}`} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                  <div>
                    <div style={{fontSize: '13px', fontWeight: '500', color: '#191f28'}}>{g.sub}</div>
                    <div style={{fontSize: '11px', color: '#8b95a1'}}>{g.main}</div>
                  </div>
                  <span style={{fontSize: '13px', fontWeight: '600', color: '#f04452'}}>{g.total.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>

          {/* 거래 내역 (접었다 펼치기) */}
          <div className="card">
            <div
              style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}
              onClick={() => setShowTransactions(!showTransactions)}
            >
              <h3>거래 내역 ({transactions.length}건)</h3>
              <span style={{fontSize: '14px', color: '#8b95a1'}}>{showTransactions ? '▲ 접기' : '▼ 펼치기'}</span>
            </div>

            {showTransactions && (
              <table style={{marginTop: '16px'}}>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>가맹점</th>
                    <th>카테고리</th>
                    <th style={{textAlign: 'right'}}>금액</th>
                    <th style={{textAlign: 'center'}}>카드</th>
                    <th style={{textAlign: 'center'}}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    editingId === t.id ? (
                      <tr key={t.id} style={{background: '#f6f8ff'}}>
                        <td><input type="date" value={editForm.date} onChange={e => setEditForm(p => ({...p, date: e.target.value}))} style={{width: '130px', fontSize: '13px'}} /></td>
                        <td><input type="text" value={editForm.merchant} onChange={e => setEditForm(p => ({...p, merchant: e.target.value}))} style={{width: '140px', fontSize: '13px'}} /></td>
                        <td style={{display: 'flex', gap: '4px'}}>
                          <select value={selectedMain} onChange={e => { const firstSub = categories.filter(c => c.main_category === e.target.value)[0]; setEditForm(p => ({...p, category_id: firstSub?.id || ''})) }} style={{fontSize: '12px', width: '80px'}}>
                            <option value="">선택</option>
                            {mainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select value={editForm.category_id} onChange={e => setEditForm(p => ({...p, category_id: e.target.value}))} style={{fontSize: '12px', width: '80px'}} disabled={!selectedMain}>
                            <option value="">선택</option>
                            {categories.filter(c => c.main_category === selectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                          </select>
                        </td>
                        <td style={{textAlign: 'right'}}><input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({...p, amount: e.target.value}))} style={{width: '100px', textAlign: 'right', fontSize: '13px'}} /></td>
                        <td><input type="text" value={editForm.card_type} onChange={e => setEditForm(p => ({...p, card_type: e.target.value}))} style={{width: '60px', fontSize: '13px', textAlign: 'center'}} /></td>
                        <td style={{textAlign: 'center'}}>
                          <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                            <button onClick={() => handleSaveEdit(t.id)} disabled={saving} style={{padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#3182f6', color: 'white', fontSize: '12px', cursor: 'pointer'}}>저장</button>
                            <button onClick={() => setEditingId(null)} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', fontSize: '12px', cursor: 'pointer'}}>취소</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={t.id}>
                        <td style={{color: '#8b95a1', fontSize: '13px'}}>{t.date}</td>
                        <td style={{fontWeight: '500'}}>{t.merchant}</td>
                        <td>
                          {t.categories
                            ? <span className="tag">{t.categories.main_category} · {t.categories.sub_category}</span>
                            : <span style={{color: '#ff8c00', fontSize: '12px', fontWeight: '500'}}>미분류</span>
                          }
                        </td>
                        <td style={{textAlign: 'right', fontWeight: '600'}}>{t.amount.toLocaleString()}원</td>
                        <td style={{textAlign: 'center'}}><span className="badge badge-primary">{t.card_type}</span></td>
                        <td style={{textAlign: 'center'}}>
                          <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                            <button onClick={() => startEdit(t)} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#3182f6'}}>수정</button>
                            <button onClick={() => handleDelete(t.id)} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#f04452'}}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyReport