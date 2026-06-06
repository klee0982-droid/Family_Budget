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

  // 지출 직접 추가
  const [manualExpenses, setManualExpenses] = useState([])
  const [newExpense, setNewExpense] = useState({ date: '', merchant: '', amount: '', category_id: '' })
  const [expenseCategories, setExpenseCategories] = useState([])

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
          .eq('card_type', '직접입력')
          .order('date', { ascending: false })
      ])
      setExpenseCategories(cats || [])
      setManualExpenses(txData || [])
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

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  const expenseMainCategories = [...new Set(expenseCategories.map(c => c.main_category))]
  const total = entries.reduce((s, e) => s + (parseInt(e.amount) || 0), 0)
  const hasData = entries.some(e => e.existing_id)
  const selectedMain = expenseCategories.find(c => c.id === newExpense.category_id)?.main_category || ''

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>수입 / 저축 / 지출 입력</h2>
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
          {/* 직접 추가 폼 */}
          <div className="card" style={{marginBottom: '16px'}}>
            <h3 style={{marginBottom: '16px'}}>지출 직접 추가</h3>
            <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end'}}>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>날짜</div>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={e => setNewExpense(p => ({...p, date: e.target.value}))}
                  style={{width: '140px'}}
                />
              </div>
              <div style={{flex: 1, minWidth: '120px'}}>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>내역</div>
                <input
                  type="text"
                  placeholder="ex) 남편 용돈"
                  value={newExpense.merchant}
                  onChange={e => setNewExpense(p => ({...p, merchant: e.target.value}))}
                  style={{width: '100%'}}
                />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>금액</div>
                <input
                  type="number"
                  placeholder="0"
                  value={newExpense.amount}
                  onChange={e => setNewExpense(p => ({...p, amount: e.target.value}))}
                  style={{width: '120px', textAlign: 'right'}}
                />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>대분류</div>
                <select
                  value={selectedMain}
                  onChange={e => {
                    const firstSub = expenseCategories.filter(c => c.main_category === e.target.value)[0]
                    setNewExpense(p => ({...p, category_id: firstSub?.id || ''}))
                  }}
                  style={{width: '100px'}}
                >
                  <option value="">선택</option>
                  {expenseMainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>소분류</div>
                <select
                  value={newExpense.category_id}
                  onChange={e => setNewExpense(p => ({...p, category_id: e.target.value}))}
                  disabled={!selectedMain}
                  style={{width: '100px'}}
                >
                  <option value="">선택</option>
                  {expenseCategories.filter(c => c.main_category === selectedMain).map(c => (
                    <option key={c.id} value={c.id}>{c.sub_category}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddExpense}
                className="btn btn-primary"
                style={{whiteSpace: 'nowrap'}}
              >
                + 추가
              </button>
            </div>
          </div>

          {/* 입력된 지출 목록 */}
          <div className="card">
            <h3 style={{marginBottom: '16px'}}>
              직접 입력 지출
              {manualExpenses.length > 0 && (
                <span style={{fontSize: '14px', color: '#8b95a1', fontWeight: '400', marginLeft: '8px'}}>
                  {manualExpenses.length}건 · {manualExpenses.reduce((s, t) => s + t.amount, 0).toLocaleString()}원
                </span>
              )}
            </h3>
            {manualExpenses.length === 0 ? (
              <p style={{color: '#8b95a1', fontSize: '14px', textAlign: 'center', padding: '24px 0'}}>
                직접 입력한 지출이 없어요
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>내역</th>
                    <th>카테고리</th>
                    <th style={{textAlign: 'right'}}>금액</th>
                    <th style={{textAlign: 'center'}}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {manualExpenses.map(t => (
                    <tr key={t.id}>
                      <td style={{color: '#8b95a1', fontSize: '13px'}}>{t.date}</td>
                      <td style={{fontWeight: '500'}}>{t.merchant}</td>
                      <td>
                        {t.categories
                          ? <span className="tag">{t.categories.main_category} · {t.categories.sub_category}</span>
                          : <span style={{color: '#ff8c00', fontSize: '12px'}}>미분류</span>
                        }
                      </td>
                      <td style={{textAlign: 'right', fontWeight: '600'}}>{t.amount.toLocaleString()}원</td>
                      <td style={{textAlign: 'center'}}>
                        <button
                          onClick={() => handleDeleteExpense(t.id)}
                          style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '12px', cursor: 'pointer'}}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
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
                  <input
                    type="number"
                    placeholder="0"
                    value={e.amount}
                    onChange={ev => handleChange(e.category_id, 'amount', ev.target.value)}
                    style={{width: '150px', textAlign: 'right'}}
                  />
                  <span style={{fontSize: '13px', color: '#8b95a1'}}>원</span>
                  <input
                    type="text"
                    placeholder="메모 (선택)"
                    value={e.memo}
                    onChange={ev => handleChange(e.category_id, 'memo', ev.target.value)}
                    style={{flex: 1}}
                  />
                  {e.existing_id && (
                    <button
                      onClick={() => {
                        if (window.confirm(`${e.sub_category} 데이터를 삭제할까요?`)) {
                          handleDelete(e.category_id)
                        }
                      }}
                      style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '12px', cursor: 'pointer'}}
                    >
                      삭제
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}

          <div style={{borderTop: '1px solid #e8ebed', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            {hasData && (
              <button
                onClick={() => {
                  if (window.confirm('이 달 전체 데이터를 삭제할까요?')) {
                    entries.filter(e => e.existing_id).forEach(e => handleDelete(e.category_id))
                  }
                }}
                style={{padding: '8px 16px', borderRadius: '8px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '13px', cursor: 'pointer'}}
              >
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