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

  useEffect(() => { fetchData() }, [tab, year, month])

  async function fetchData() {
    setLoading(true)
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

  async function handleSave() {
    setSaving(true)
    const table = tab === 'income' ? 'incomes' : 'savings'
    const toSave = entries.filter(e => e.amount !== '' && parseInt(e.amount) > 0)

    for (const e of toSave) {
      const row = { year, month, category_id: e.category_id, amount: parseInt(e.amount), memo: e.memo }
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

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  const total = entries.reduce((s, e) => s + (parseInt(e.amount) || 0), 0)

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>수입 / 저축 입력</h2>
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
        {['income', 'saving'].map(t => (
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
            {t === 'income' ? '수입' : '저축'}
          </button>
        ))}
      </div>

      {total > 0 && (
        <div className="stat-card" style={{marginBottom: '20px', display: 'inline-block', minWidth: '200px'}}>
          <div className="label">{tab === 'income' ? '총 수입' : '총 저축'}</div>
          <div className="value" style={{color: tab === 'income' ? '#00b493' : '#3182f6'}}>
            {total.toLocaleString()}원
          </div>
        </div>
      )}

      {loading ? (
        <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0'}}>불러오는 중...</div>
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
                </div>
              ))}
            </div>
          ))}

          <div style={{borderTop: '1px solid #e8ebed', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end'}}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Income