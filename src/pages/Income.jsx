import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Income() {
  const [tab, setTab] = useState('income')
  const [categories, setCategories] = useState([])
  const [entries, setEntries] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // 지출 관련
  const [allExpenses, setAllExpenses] = useState([])
  const [newExpense, setNewExpense] = useState({ date: '', merchant: '', amount: '', category_id: '' })
  const [expenseCategories, setExpenseCategories] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => { fetchData() }, [tab, year, month])

  async function fetchData() {
    setLoading(true)

    if (tab === 'expense') {
      const [{ data: cats }, { data: txData }] = await Promise.all([
        supabase.from('categories').select('*').eq('type', 'expense').order('sort_order'),
        supabase.from('transactions')
          .select('*, categories(main_category, sub_category)')
          .eq('year', year)
          .eq('month', month)
          .order('date', { ascending: false })
      ])
      setExpenseCategories(cats || [])
      setAllExpenses(txData || [])
      setLoading(false)
      return
    }

    const table = tab === 'income' ? 'incomes' : 'savings'
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('type', tab === 'income' ? 'income' : 'saving')
      .order('sort_order')

    const { data: existing } = await supabase
      .from(table)
      .select('*')
      .eq('year', year)
      .eq('month', month)

    const catList = cats || []
    const existingMap = {}
    ;(existing || []).forEach(e => { existingMap[e.category_id] = e })

    setCategories(catList)
    setEntries(catList.map(c => ({
      category_id: c.id,
      main_category: c.main_category,
      sub_category: c.sub_category,
      amount: existingMap[c.id]?.amount || '',
      memo: existingMap[c.id]?.memo || '',
      existing_id: existingMap[c.id]?.id || null,
    })))
    setLoading(false)
  }

  function handleChange(categoryId, field, value) {
    setEntries(prev =>
      prev.map(e => e.category_id === categoryId ? { ...e, [field]: value } : e)
    )
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
      if ((!e.amount || amount === 0) && e.existing_id) {
        await supabase.from(table).delete().eq('id', e.existing_id)
        continue
      }
      if (!e.amount || amount <= 0) continue
      const row = { year, month, category_id: e.category_id, amount, memo: e.memo }
      if (e.existing_id) {
        await supabase.from(table).update(row).eq('id', e.existing_id)
      } else {
        await supabase.from(table).insert(row)
      }
    }

    await fetchData()
    setSaving(false)
    alert('저장 완료!')
  }

  async function handleAddExpense() {
    if (!newExpense.date || !newExpense.merchant || !newExpense.amount) {
      alert('날짜, 내역, 금액을 모두 입력해주세요.')
      return
    }
    const [yr, mo] = newExpense.date.split('-')
    const { error } = await supabase.from('transactions').insert({
      year: parseInt(yr),
      month: parseInt(mo),
      date: newExpense.date,
      merchant: newExpense.merchant,
      amount: parseInt(newExpense.amount),
      card_type: '직접입력',
      category_id: newExpense.category_id || null,
    })
    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      setNewExpense({ date: '', merchant: '', amount: '', category_id: '' })
      await fetchData()
    }
  }

  async function handleDeleteExpense(id) {
    if (!window.confirm('삭제할까요?')) return
    await supabase.from('transactions').delete().eq('id', id)
    await fetchData()
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      category_id: t.category_id || '',
      card_type: t.card_type || '',
    })
  }

  async function handleSaveEdit(id) {
    setSaving(true)
    const [yr, mo] = editForm.date.split('-')
    await supabase.from('transactions').update({
      date: editForm.date,
      merchant: editForm.merchant,
      amount: parseInt(editForm.amount),
      category_id: editForm.category_id || null,
      card_type: editForm.card_type,
      year: parseInt(yr),
      month: parseInt(mo),
    }).eq('id', id)
    setEditingId(null)
    await fetchData()
    setSaving(false)
  }

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  const expenseMainCategories = [...new Set(expenseCategories.map(c => c.main_category))]
  const total = entries.reduce((s, e) => s + (parseInt(e.amount) || 0), 0)
  const hasData = entries.some(e => e.existing_id)
  const selectedMain = expenseCategories.find(c => c.id === newExpense.category_id)?.main_category || ''
  const editSelectedMain = expenseCategories.find(c => c.id === editForm.category_id)?.main_category || ''
  const totalExpense = allExpenses.reduce((s, t) => s + t.amount, 0)
  const uncategorized = allExpenses.filter(t => !t.category_id)

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
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              background: tab === t ? '#3182f6' : '#f2f4f6',
              color: tab === t ? 'white' : '#8b95a1',
              cursor: 'pointer',
            }}
          >
            {t === 'income' ? '수입' : t === 'saving' ? '저축' : '지출'}
          </button>
        ))}
      </div>

      {tab !== 'expense' && total > 0 && (
        <div className="stat-card" style={{marginBottom: '20px', display: 'inline-block', minWidth: '200px'}}>
          <div className="label">{tab === 'income' ? '총 수입' : '총 저축'}</div>
          <div className="value" style={{color: tab === 'income' ? '#00b493' : '#3182f6'}}>
            {total.toLocaleString()}원
          </div>
        </div>
      )}

      {loading ? (
        <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0'}}>불러오는 중...</div>
      ) : tab === 'expense' ? (
        <div>
          {/* 요약 */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px'}}>
            <div className="stat-card">
              <div className="label">총 지출</div>
              <div className="value" style={{color: '#f04452'}}>{totalExpense.toLocaleString()}원</div>
            </div>
            <div className="stat-card">
              <div className="label">분류 완료</div>
              <div className="value" style={{color: '#00b493'}}>{allExpenses.length - uncategorized.length}건</div>
            </div>
            <div className="stat-card">
              <div className="label">미분류</div>
              <div className="value" style={{color: uncategorized.length > 0 ? '#ff8c00' : '#00b493'}}>
                {uncategorized.length}건
              </div>
            </div>
          </div>

          {uncategorized.length > 0 && (
            <div style={{background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#ff8c00', fontWeight: '500'}}>
              ⚠ 미분류 {uncategorized.length}건이 있어요. 카테고리 분류 페이지에서 분류해주세요.
            </div>
          )}

          {/* 직접 추가 폼 */}
          <div className="card" style={{marginBottom: '16px'}}>
            <h3 style={{marginBottom: '16px'}}>지출 직접 추가</h3>
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end'}}>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>날짜</div>
                <input type="date" value={newExpense.date} onChange={e => setNewExpense(p => ({...p, date: e.target.value}))} style={{width: '140px'}} />
              </div>
              <div style={{flex: 1, minWidth: '120px'}}>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>내역</div>
                <input type="text" placeholder="ex) 남편 용돈" value={newExpense.merchant} onChange={e => setNewExpense(p => ({...p, merchant: e.target.value}))} style={{width: '100%'}} />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>금액</div>
                <input type="number" placeholder="0" value={newExpense.amount} onChange={e => setNewExpense(p => ({...p, amount: e.target.value}))} style={{width: '120px', textAlign: 'right'}} />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>대분류</div>
                <select value={selectedMain} onChange={e => { const firstSub = expenseCategories.filter(c => c.main_category === e.target.value)[0]; setNewExpense(p => ({...p, category_id: firstSub?.id || ''})) }} style={{width: '100px'}}>
                  <option value="">선택</option>
                  {expenseMainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>소분류</div>
                <select value={newExpense.category_id} onChange={e => setNewExpense(p => ({...p, category_id: e.target.value}))} disabled={!selectedMain} style={{width: '100px'}}>
                  <option value="">선택</option>
                  {expenseCategories.filter(c => c.main_category === selectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                </select>
              </div>
              <button onClick={handleAddExpense} className="btn btn-primary" style={{whiteSpace: 'nowrap'}}>+ 추가</button>
            </div>
          </div>

          {/* 전체 지출 목록 */}
          <div className="card">
            <h3 style={{marginBottom: '16px'}}>
              전체 지출 내역
              <span style={{fontSize: '13px', color: '#8b95a1', fontWeight: '400', marginLeft: '8px'}}>
                {allExpenses.length}건
              </span>
            </h3>
            {allExpenses.length === 0 ? (
              <p style={{color: '#8b95a1', fontSize: '14px', textAlign: 'center', padding: '24px 0'}}>지출 내역이 없어요</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>내역</th>
                    <th>카테고리</th>
                    <th style={{textAlign: 'right'}}>금액</th>
                    <th style={{textAlign: 'center'}}>구분</th>
                    <th style={{textAlign: 'center'}}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {allExpenses.map(t => (
                    editingId === t.id ? (
                      <tr key={t.id} style={{background: '#f6f8ff'}}>
                        <td><input type="date" value={editForm.date} onChange={e => setEditForm(p => ({...p, date: e.target.value}))} style={{width: '130px', fontSize: '13px'}} /></td>
                        <td><input type="text" value={editForm.merchant} onChange={e => setEditForm(p => ({...p, merchant: e.target.value}))} style={{width: '120px', fontSize: '13px'}} /></td>
                        <td style={{display: 'flex', gap: '4px'}}>
                          <select value={editSelectedMain} onChange={e => { const firstSub = expenseCategories.filter(c => c.main_category === e.target.value)[0]; setEditForm(p => ({...p, category_id: firstSub?.id || ''})) }} style={{fontSize: '12px', width: '80px'}}>
                            <option value="">선택</option>
                            {expenseMainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <select value={editForm.category_id} onChange={e => setEditForm(p => ({...p, category_id: e.target.value}))} style={{fontSize: '12px', width: '80px'}} disabled={!editSelectedMain}>
                            <option value="">선택</option>
                            {expenseCategories.filter(c => c.main_category === editSelectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                          </select>
                        </td>
                        <td><input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({...p, amount: e.target.value}))} style={{width: '100px', textAlign: 'right', fontSize: '13px'}} /></td>
                        <td><input type="text" value={editForm.card_type} onChange={e => setEditForm(p => ({...p, card_type: e.target.value}))} style={{width: '60px', fontSize: '13px'}} /></td>
                        <td>
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
                        <td style={{textAlign: 'center'}}>
                          <span className="badge" style={{
                            background: t.card_type === '직접입력' ? '#f2f4f6' : '#ebf3fe',
                            color: t.card_type === '직접입력' ? '#8b95a1' : '#3182f6',
                          }}>{t.card_type || '-'}</span>
                        </td>
                        <td style={{textAlign: 'center'}}>
                          <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                            <button onClick={() => startEdit(t)} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#3182f6'}}>수정</button>
                            <button onClick={() => handleDeleteExpense(t.id)} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#f04452'}}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          {mainCategories.map(main => (
            <div key={main} style={{marginBottom: '28px'}}>
              <div className="section-title">{main}</div>
              {entries.filter(e => e.main_category === main).map(e => (
                <div key={e.category_id} style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px'}}>
                  <span style={{width: '130px', fontSize: '14px', color: '#191f28'}}>{e.sub_category}</span>
                  <input type="number" placeholder="0" value={e.amount} onChange={ev => handleChange(e.category_id, 'amount', ev.target.value)} style={{width: '150px', textAlign: 'right'}} />
                  <span style={{fontSize: '13px', color: '#8b95a1'}}>원</span>
                  <input type="text" placeholder="메모 (선택)" value={e.memo} onChange={ev => handleChange(e.category_id, 'memo', ev.target.value)} style={{flex: 1}} />
                  {e.existing_id && (
                    <button onClick={() => { if (window.confirm(`${e.sub_category} 데이터를 삭제할까요?`)) { handleDelete(e.category_id) } }} style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '12px', cursor: 'pointer'}}>삭제</button>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div style={{borderTop: '1px solid #e8ebed', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            {hasData && (
              <button onClick={() => { if (window.confirm('이 달 전체 데이터를 삭제할까요?')) { entries.filter(e => e.existing_id).forEach(e => handleDelete(e.category_id)) } }} style={{padding: '8px 16px', borderRadius: '8px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '13px', cursor: 'pointer'}}>
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