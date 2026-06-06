import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const defaultMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth()
const defaultYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()

function Income() {
  const [tab, setTab] = useState('income')
  const [categories, setCategories] = useState([])
  const [entries, setEntries] = useState([])
  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [manualExpenses, setManualExpenses] = useState([])
  const [cardExpenses, setCardExpenses] = useState([])
  const [uncategorizedExpenses, setUncategorizedExpenses] = useState([])
  const [prevManualExpenses, setPrevManualExpenses] = useState([])
  const [newExpense, setNewExpense] = useState({ date: '', merchant: '', amount: '', category_id: '' })
  const [expenseCategories, setExpenseCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showUncategorized, setShowUncategorized] = useState(true)
  const [showPrevManual, setShowPrevManual] = useState(false)
  const [copyingPrev, setCopyingPrev] = useState(false)

  useEffect(() => { fetchData() }, [tab, year, month])

  async function fetchData() {
    setLoading(true)

    if (tab === 'expense') {
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year

      const [{ data: cats }, { data: txData }, { data: rules }, { data: prevTxData }] = await Promise.all([
        supabase.from('categories').select('*').eq('type', 'expense').order('sort_order'),
        supabase.from('transactions')
          .select('*, categories(main_category, sub_category)')
          .eq('year', year).eq('month', month)
          .order('date', { ascending: false }),
        supabase.from('merchant_rules').select('*, categories(*)'),
        supabase.from('transactions')
          .select('*, categories(main_category, sub_category)')
          .eq('year', prevYear).eq('month', prevMonth)
          .eq('card_type', '직접입력')
          .order('date', { ascending: false }),
      ])
      setExpenseCategories(cats || [])

      const allTx = txData || []
      const ruleList = rules || []

      const uncat = allTx
        .filter(t => !t.category_id)
        .map(t => {
          const rule = ruleList.find(r => r.merchant_name === t.merchant)
          return { ...t, suggestedCategory: rule?.category_id || '', autoMapped: !!rule }
        })

      setUncategorizedExpenses(uncat)
      setManualExpenses(allTx.filter(t => t.category_id && t.card_type === '직접입력'))
      setCardExpenses(allTx.filter(t => t.category_id && t.card_type !== '직접입력'))
      setPrevManualExpenses(prevTxData || [])
      setLoading(false)
      return
    }

    const table = tab === 'income' ? 'incomes' : 'savings'
    const { data: cats } = await supabase.from('categories').select('*').eq('type', tab === 'income' ? 'income' : 'saving').order('sort_order')
    const { data: existing } = await supabase.from(table).select('*').eq('year', year).eq('month', month)

    const catList = cats || []
    const existingMap = {}
    ;(existing || []).forEach(e => { existingMap[e.category_id] = e })

    let prevMap = {}
    if (Object.keys(existingMap).length === 0) {
      const prevMonth = month === 1 ? 12 : month - 1
      const prevYear = month === 1 ? year - 1 : year
      const { data: prevData } = await supabase.from(table).select('*').eq('year', prevYear).eq('month', prevMonth)
      ;(prevData || []).forEach(e => { prevMap[e.category_id] = e })
    }

    setCategories(catList)
    setEntries(catList.map(c => {
      const current = existingMap[c.id]
      const prev = prevMap[c.id]
      return {
        category_id: c.id,
        main_category: c.main_category,
        sub_category: c.sub_category,
        amount: current?.amount || prev?.amount || '',
        memo: current?.memo || prev?.memo || '',
        existing_id: current?.id || null,
        isPrefilled: !current && !!prev,
      }
    }))
    setLoading(false)
  }

  function handleChange(categoryId, field, value) {
    setEntries(prev => prev.map(e => e.category_id === categoryId ? { ...e, [field]: value, isPrefilled: false } : e))
  }

  async function handleDelete(categoryId) {
    const entry = entries.find(e => e.category_id === categoryId)
    if (!entry?.existing_id) return
    const table = tab === 'income' ? 'incomes' : 'savings'
    await supabase.from(table).delete().eq('id', entry.existing_id)
    await fetchData()
  }

  async function handleSave() {
    setSaving(true)
    const table = tab === 'income' ? 'incomes' : 'savings'
    for (const e of entries) {
      const amount = parseInt(e.amount)
      if ((!e.amount || amount === 0) && e.existing_id) { await supabase.from(table).delete().eq('id', e.existing_id); continue }
      if (!e.amount || amount <= 0) continue
      const row = { year, month, category_id: e.category_id, amount, memo: e.memo }
      if (e.existing_id) { await supabase.from(table).update(row).eq('id', e.existing_id) }
      else { await supabase.from(table).insert(row) }
    }
    await fetchData()
    setSaving(false)
    alert('저장 완료!')
  }

  async function handleAddExpense() {
    if (!newExpense.date || !newExpense.merchant || !newExpense.amount) { alert('날짜, 내역, 금액을 모두 입력해주세요.'); return }
    const [yr, mo] = newExpense.date.split('-')
    await supabase.from('transactions').insert({
      year: parseInt(yr), month: parseInt(mo), date: newExpense.date,
      merchant: newExpense.merchant, amount: parseInt(newExpense.amount),
      card_type: '직접입력', category_id: newExpense.category_id || null,
    })
    setNewExpense({ date: '', merchant: '', amount: '', category_id: '' })
    await fetchData()
  }

  async function handleDeleteExpense(id) {
    if (!window.confirm('삭제할까요?')) return
    await supabase.from('transactions').delete().eq('id', id)
    await fetchData()
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({ date: t.date, merchant: t.merchant, amount: t.amount, category_id: t.category_id || '', card_type: t.card_type || '' })
  }

  async function handleSaveEdit(id) {
    setSaving(true)
    const [yr, mo] = editForm.date.split('-')
    await supabase.from('transactions').update({
      date: editForm.date, merchant: editForm.merchant, amount: parseInt(editForm.amount),
      category_id: editForm.category_id || null, card_type: editForm.card_type,
      year: parseInt(yr), month: parseInt(mo),
    }).eq('id', id)
    setEditingId(null)
    await fetchData()
    setSaving(false)
  }

  function handleUncatChange(id, categoryId) {
    setUncategorizedExpenses(prev => prev.map(t => t.id === id ? { ...t, suggestedCategory: categoryId, autoMapped: false } : t))
  }

  async function handleUncatSave() {
    setSaving(true)
    const toUpdate = uncategorizedExpenses.filter(t => t.suggestedCategory)
    for (const t of toUpdate) {
      await supabase.from('transactions').update({ category_id: t.suggestedCategory }).eq('id', t.id)
      if (!t.autoMapped) {
        await supabase.from('merchant_rules').upsert({ merchant_name: t.merchant, category_id: t.suggestedCategory }, { onConflict: 'merchant_name' })
      }
    }
    await fetchData()
    setSaving(false)
  }

  // 전달 직접 입력 내역 이번 달로 복사
  async function handleCopyPrevManual() {
    if (!window.confirm(`전달 직접 입력 내역 ${prevManualExpenses.length}건을 이번 달로 복사할까요?`)) return
    setCopyingPrev(true)
    // 날짜를 이번 달 1일로 변경해서 복사
    const rows = prevManualExpenses.map(t => ({
      year,
      month,
      date: `${year}-${String(month).padStart(2, '0')}-01`,
      merchant: t.merchant,
      amount: t.amount,
      card_type: '직접입력',
      category_id: t.category_id || null,
    }))
    await supabase.from('transactions').insert(rows)
    await fetchData()
    setCopyingPrev(false)
    setShowPrevManual(false)
  }

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  const expenseMainCategories = [...new Set(expenseCategories.map(c => c.main_category))]
  const total = entries.reduce((s, e) => s + (parseInt(e.amount) || 0), 0)
  const hasData = entries.some(e => e.existing_id)
  const hasPrefilled = entries.some(e => e.isPrefilled)
  const selectedMain = expenseCategories.find(c => c.id === newExpense.category_id)?.main_category || ''
  const editSelectedMain = expenseCategories.find(c => c.id === editForm.category_id)?.main_category || ''
  const totalManual = manualExpenses.reduce((s, t) => s + t.amount, 0)
  const totalCard = cardExpenses.reduce((s, t) => s + t.amount, 0)
  const uncatReadyCount = uncategorizedExpenses.filter(t => t.suggestedCategory).length
  const hasManualThisMonth = manualExpenses.length > 0

  function ExpenseCard({ t }) {
    if (editingId === t.id) {
      return (
        <div style={{background: '#f0f7ff', borderRadius: '10px', padding: '12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
          <div style={{display: 'flex', gap: '6px'}}>
            <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({...p, date: e.target.value}))} style={{flex: 1, fontSize: '13px'}} />
            <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({...p, amount: e.target.value}))} style={{width: '100px', textAlign: 'right', fontSize: '13px'}} />
          </div>
          <input type="text" value={editForm.merchant} onChange={e => setEditForm(p => ({...p, merchant: e.target.value}))} style={{width: '100%', fontSize: '13px'}} />
          <div style={{display: 'flex', gap: '6px'}}>
            <select value={editSelectedMain} onChange={e => { const f = expenseCategories.filter(c => c.main_category === e.target.value)[0]; setEditForm(p => ({...p, category_id: f?.id || ''})) }} style={{flex: 1, fontSize: '13px'}}>
              <option value="">대분류</option>
              {expenseMainCategories.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={editForm.category_id} onChange={e => setEditForm(p => ({...p, category_id: e.target.value}))} disabled={!editSelectedMain} style={{flex: 1, fontSize: '13px'}}>
              <option value="">소분류</option>
              {expenseCategories.filter(c => c.main_category === editSelectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
            </select>
          </div>
          <div style={{display: 'flex', gap: '6px'}}>
            <button onClick={() => handleSaveEdit(t.id)} disabled={saving} className="btn btn-primary" style={{flex: 1, padding: '8px'}}>저장</button>
            <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{flex: 1, padding: '8px'}}>취소</button>
          </div>
        </div>
      )
    }
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f2f4f6'}}>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px'}}>
            <span style={{fontSize: '14px', fontWeight: '500', color: '#191f28', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{t.merchant}</span>
            {t.categories
              ? <span className="tag" style={{fontSize: '11px', flexShrink: 0}}>{t.categories.main_category} · {t.categories.sub_category}</span>
              : <span style={{color: '#ff8c00', fontSize: '11px', flexShrink: 0}}>미분류</span>
            }
          </div>
          <span style={{fontSize: '12px', color: '#b0b8c1'}}>{t.date}{t.card_type && t.card_type !== '직접입력' ? ` · ${t.card_type}` : ''}</span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px'}}>
          <span style={{fontSize: '14px', fontWeight: '600', color: '#f04452'}}>{t.amount.toLocaleString()}원</span>
          <button onClick={() => startEdit(t)} style={{padding: '4px 8px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#3182f6'}}>수정</button>
          <button onClick={() => handleDeleteExpense(t.id)} style={{padding: '4px 8px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#f04452'}}>삭제</button>
        </div>
      </div>
    )
  }

  const prevMonth = month === 1 ? 12 : month - 1

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>수입 / 저축 / 지출</h2>
        <div style={{display: 'flex', gap: '8px'}}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      <div style={{display: 'flex', gap: '8px', marginBottom: '24px'}}>
        {['income', 'saving', 'expense'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: '10px', border: 'none',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: tab === t ? '#3182f6' : '#f2f4f6',
            color: tab === t ? 'white' : '#8b95a1',
          }}>
            {t === 'income' ? '수입' : t === 'saving' ? '저축' : (
              <span>지출 {uncategorizedExpenses.length > 0 && tab !== 'expense' && (
                <span style={{background: '#f04452', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '11px', marginLeft: '4px'}}>{uncategorizedExpenses.length}</span>
              )}</span>
            )}
          </button>
        ))}
      </div>

      {tab !== 'expense' && total > 0 && (
        <div className="stat-card" style={{marginBottom: '20px', display: 'inline-block', minWidth: '200px'}}>
          <div className="label">{tab === 'income' ? '총 수입' : '총 저축'}</div>
          <div className="value" style={{color: tab === 'income' ? '#00b493' : '#3182f6'}}>{total.toLocaleString()}원</div>
        </div>
      )}

      {loading ? (
        <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0'}}>불러오는 중...</div>
      ) : tab === 'expense' ? (
        <div>
          {/* 미분류 섹션 */}
          {uncategorizedExpenses.length > 0 && (
            <div className="card" style={{marginBottom: '16px', border: '1px solid #ffd591'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}} onClick={() => setShowUncategorized(!showUncategorized)}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <span style={{fontSize: '16px'}}>⚠️</span>
                  <div>
                    <h3 style={{color: '#ff8c00', marginBottom: '2px'}}>미분류 {uncategorizedExpenses.length}건</h3>
                    <p style={{fontSize: '12px', color: '#8b95a1'}}>카테고리를 지정해주세요</p>
                  </div>
                </div>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                  {uncatReadyCount > 0 && (
                    <button onClick={e => { e.stopPropagation(); handleUncatSave() }} disabled={saving} className="btn btn-primary" style={{padding: '6px 14px', fontSize: '13px'}}>
                      {saving ? '저장 중...' : `${uncatReadyCount}건 저장`}
                    </button>
                  )}
                  <span style={{fontSize: '13px', color: '#8b95a1'}}>{showUncategorized ? '▲' : '▼'}</span>
                </div>
              </div>
              {showUncategorized && (
                <div style={{marginTop: '16px'}}>
                  {uncategorizedExpenses.map(t => {
                    const sugMain = expenseCategories.find(c => c.id === t.suggestedCategory)?.main_category || ''
                    return (
                      <div key={t.id} style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f2f4f6', flexWrap: 'wrap'}}>
                        <div style={{flex: 1, minWidth: '120px'}}>
                          <div style={{fontSize: '13px', fontWeight: '500', color: '#191f28'}}>{t.merchant}</div>
                          <div style={{fontSize: '11px', color: '#b0b8c1'}}>{t.date} · {t.amount.toLocaleString()}원</div>
                        </div>
                        {t.autoMapped && <span className="badge badge-success" style={{fontSize: '11px'}}>룰 적용</span>}
                        <select value={sugMain} onChange={e => { const f = expenseCategories.filter(c => c.main_category === e.target.value)[0]; handleUncatChange(t.id, f?.id || '') }} style={{fontSize: '12px', width: '90px'}}>
                          <option value="">대분류</option>
                          {expenseMainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select value={t.suggestedCategory} onChange={e => handleUncatChange(t.id, e.target.value)} disabled={!sugMain} style={{fontSize: '12px', width: '90px'}}>
                          <option value="">소분류</option>
                          {expenseCategories.filter(c => c.main_category === sugMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                        </select>
                        <button onClick={() => handleDeleteExpense(t.id)} style={{padding: '3px 8px', borderRadius: '4px', border: '1px solid #f04452', background: 'white', fontSize: '11px', cursor: 'pointer', color: '#f04452'}}>삭제</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 요약 */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px'}}>
            <div className="stat-card">
              <div className="label">직접 입력</div>
              <div className="value" style={{color: '#7c3aed'}}>{totalManual.toLocaleString()}원</div>
            </div>
            <div className="stat-card">
              <div className="label">카드 지출</div>
              <div className="value" style={{color: '#f04452'}}>{totalCard.toLocaleString()}원</div>
            </div>
            <div className="stat-card">
              <div className="label">총 지출</div>
              <div className="value" style={{color: '#191f28'}}>{(totalManual + totalCard).toLocaleString()}원</div>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            {/* 직접 입력 */}
            <div className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>직접 입력</h3>
                <span style={{fontSize: '13px', fontWeight: '700', color: '#7c3aed'}}>{totalManual.toLocaleString()}원</span>
              </div>

              {/* 전달 내역 참고 배너 */}
              {!hasManualThisMonth && prevManualExpenses.length > 0 && (
                <div style={{background: '#ebf3fe', border: '1px solid #c3d9fd', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPrevManual ? '10px' : 0}}>
                    <div>
                      <span style={{fontSize: '13px', color: '#3182f6', fontWeight: '600'}}>💡 {prevMonth}월 직접 입력 내역 {prevManualExpenses.length}건</span>
                      <span style={{fontSize: '12px', color: '#8b95a1', marginLeft: '6px'}}>참고하거나 복사할 수 있어요</span>
                    </div>
                    <div style={{display: 'flex', gap: '6px'}}>
                      <button
                        onClick={() => setShowPrevManual(!showPrevManual)}
                        style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #c3d9fd', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#3182f6'}}
                      >
                        {showPrevManual ? '접기' : '보기'}
                      </button>
                      <button
                        onClick={handleCopyPrevManual}
                        disabled={copyingPrev}
                        style={{padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#3182f6', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '600'}}
                      >
                        {copyingPrev ? '복사 중...' : '전체 복사'}
                      </button>
                    </div>
                  </div>
                  {showPrevManual && (
                    <div>
                      {prevManualExpenses.map(t => (
                        <div key={t.id} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #dbeafe'}}>
                          <div>
                            <span style={{fontSize: '13px', color: '#191f28', fontWeight: '500'}}>{t.merchant}</span>
                            {t.categories && <span className="tag" style={{fontSize: '11px', marginLeft: '6px'}}>{t.categories.main_category} · {t.categories.sub_category}</span>}
                          </div>
                          <span style={{fontSize: '13px', fontWeight: '600', color: '#7c3aed'}}>{t.amount.toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{background: '#f9fafb', borderRadius: '10px', padding: '12px', marginBottom: '16px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  <div style={{display: 'flex', gap: '6px'}}>
                    <input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({...p, date: e.target.value}))} style={{flex: 1, fontSize: '13px'}} />
                    <input type="number" placeholder="금액" value={newExpense.amount} onChange={e => setNewExpense(p => ({...p, amount: e.target.value}))} style={{width: '90px', textAlign: 'right', fontSize: '13px'}} />
                  </div>
                  <input type="text" placeholder="내역 (예: 남편 용돈)" value={newExpense.merchant} onChange={e => setNewExpense(p => ({...p, merchant: e.target.value}))} style={{width: '100%', fontSize: '13px'}} />
                  <div style={{display: 'flex', gap: '6px'}}>
                    <select value={selectedMain} onChange={e => { const f = expenseCategories.filter(c => c.main_category === e.target.value)[0]; setNewExpense(p => ({...p, category_id: f?.id || ''})) }} style={{flex: 1, fontSize: '13px'}}>
                      <option value="">대분류</option>
                      {expenseMainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select value={newExpense.category_id} onChange={e => setNewExpense(p => ({...p, category_id: e.target.value}))} disabled={!selectedMain} style={{flex: 1, fontSize: '13px'}}>
                      <option value="">소분류</option>
                      {expenseCategories.filter(c => c.main_category === selectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                    </select>
                  </div>
                  <button onClick={handleAddExpense} className="btn btn-primary" style={{width: '100%'}}>+ 추가</button>
                </div>
              </div>
              {manualExpenses.length === 0
                ? <p style={{color: '#b0b8c1', fontSize: '13px', textAlign: 'center', padding: '16px 0'}}>직접 입력한 지출이 없어요</p>
                : manualExpenses.map(t => <ExpenseCard key={t.id} t={t} />)
              }
            </div>

            {/* 카드 내역 */}
            <div className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3>카드 내역</h3>
                <span style={{fontSize: '13px', fontWeight: '700', color: '#f04452'}}>{totalCard.toLocaleString()}원</span>
              </div>
              {cardExpenses.length === 0
                ? <p style={{color: '#b0b8c1', fontSize: '13px', textAlign: 'center', padding: '16px 0'}}>카드 내역이 없어요</p>
                : cardExpenses.map(t => <ExpenseCard key={t.id} t={t} />)
              }
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          {hasPrefilled && (
            <div style={{background: '#ebf3fe', border: '1px solid #c3d9fd', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#3182f6', fontWeight: '500'}}>
              💡 이번 달 데이터가 없어서 전달 값을 불러왔어요. 수정 후 저장해주세요.
            </div>
          )}
          {mainCategories.map(main => (
            <div key={main} style={{marginBottom: '28px'}}>
              <div className="section-title">{main}</div>
              {entries.filter(e => e.main_category === main).map(e => (
                <div key={e.category_id} style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px'}}>
                  <span style={{width: '130px', fontSize: '14px', color: '#191f28'}}>{e.sub_category}</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={e.amount}
                    onChange={ev => handleChange(e.category_id, 'amount', ev.target.value)}
                    style={{
                      width: '150px', textAlign: 'right',
                      border: e.isPrefilled ? '1.5px solid #c3d9fd' : undefined,
                      background: e.isPrefilled ? '#f0f7ff' : undefined,
                    }}
                  />
                  <span style={{fontSize: '13px', color: '#8b95a1'}}>원</span>
                  <input type="text" placeholder="메모 (선택)" value={e.memo} onChange={ev => handleChange(e.category_id, 'memo', ev.target.value)} style={{flex: 1}} />
                  {e.existing_id && (
                    <button onClick={() => { if (window.confirm(`${e.sub_category} 데이터를 삭제할까요?`)) handleDelete(e.category_id) }} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '12px', cursor: 'pointer'}}>삭제</button>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{borderTop: '1px solid #e8ebed', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            {hasData && (
              <button onClick={() => { if (window.confirm('이 달 전체 데이터를 삭제할까요?')) entries.filter(e => e.existing_id).forEach(e => handleDelete(e.category_id)) }} style={{padding: '8px 16px', borderRadius: '8px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '13px', cursor: 'pointer'}}>
                이 달 전체 삭제
              </button>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{marginLeft: 'auto'}}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Income