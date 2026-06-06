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

  useEffect(() => {
    fetchData()
  }, [tab, year, month])

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
      const row = {
        year,
        month,
        category_id: e.category_id,
        amount: parseInt(e.amount),
        memo: e.memo,
      }
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

  return (
    <div style={{maxWidth: '700px'}}>
      <h2>수입 / 저축 입력</h2>

      <div style={{display: 'flex', gap: '8px', marginBottom: '24px'}}>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>

      <div style={{display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #eee'}}>
        {['income', 'saving'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t ? '600' : '400',
              borderBottom: tab === t ? '2px solid #4f46e5' : '2px solid transparent',
              marginBottom: '-2px',
              color: tab === t ? '#4f46e5' : '#666',
            }}
          >
            {t === 'income' ? '수입' : '저축'}
          </button>
        ))}
      </div>

      {loading ? <div>불러오는 중...</div> : (
        <>
          {mainCategories.map(main => (
            <div key={main} style={{marginBottom: '24px'}}>
              <h3 style={{fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '600'}}>{main}</h3>
              {entries.filter(e => e.main_category === main).map(e => (
                <div key={e.category_id} style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px'}}>
                  <span style={{width: '120px', fontSize: '14px'}}>{e.sub_category}</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={e.amount}
                    onChange={ev => handleChange(e.category_id, 'amount', ev.target.value)}
                    style={{width: '140px', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right'}}
                  />
                  <span style={{fontSize: '13px', color: '#666'}}>원</span>
                  <input
                    type="text"
                    placeholder="메모"
                    value={e.memo}
                    onChange={ev => handleChange(e.category_id, 'memo', ev.target.value)}
                    style={{flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}
                  />
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{padding: '10px 28px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '8px'}}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </>
      )}
    </div>
  )
}

export default Income