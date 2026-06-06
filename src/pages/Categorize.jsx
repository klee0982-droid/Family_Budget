import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Categorize() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: txData }, { data: catData }] = await Promise.all([
      supabase.from('transactions').select('*').is('category_id', null).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('type', 'expense').order('sort_order')
    ])
    setTransactions((txData || []).map(t => ({ ...t, selectedCategory: '' })))
    setCategories(catData || [])
    setLoading(false)
  }

  const mainCategories = [...new Set(categories.map(c => c.main_category))]

  function getSubCategories(main) {
    return categories.filter(c => c.main_category === main)
  }

  function handleCategoryChange(id, categoryId) {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, selectedCategory: categoryId } : t)
    )
  }

  async function handleSave() {
    setSaving(true)
    const toUpdate = transactions.filter(t => t.selectedCategory)

    for (const t of toUpdate) {
      await supabase
        .from('transactions')
        .update({ category_id: t.selectedCategory })
        .eq('id', t.id)
    }

    await fetchData()
    setSaving(false)
  }

  if (loading) return <div>불러오는 중...</div>

  return (
    <div style={{maxWidth: '900px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h2 style={{margin: 0}}>카테고리 분류</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{padding: '8px 20px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {transactions.length === 0 ? (
        <p style={{color: '#666'}}>분류할 거래가 없어요. 카드내역을 먼저 업로드해주세요!</p>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
          <thead>
            <tr style={{borderBottom: '2px solid #eee'}}>
              <th style={{padding: '8px', textAlign: 'left'}}>날짜</th>
              <th style={{padding: '8px', textAlign: 'left'}}>가맹점</th>
              <th style={{padding: '8px', textAlign: 'right'}}>금액</th>
              <th style={{padding: '8px', textAlign: 'left'}}>대분류</th>
              <th style={{padding: '8px', textAlign: 'left'}}>소분류</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => {
              const selectedMain = categories.find(c => c.id === t.selectedCategory)?.main_category || ''
              return (
                <tr key={t.id} style={{borderBottom: '1px solid #f0f0f0'}}>
                  <td style={{padding: '8px'}}>{t.date}</td>
                  <td style={{padding: '8px'}}>{t.merchant}</td>
                  <td style={{padding: '8px', textAlign: 'right'}}>{t.amount.toLocaleString()}원</td>
                  <td style={{padding: '8px'}}>
                    <select
                      value={selectedMain}
                      onChange={e => {
                        const firstSub = getSubCategories(e.target.value)[0]
                        handleCategoryChange(t.id, firstSub?.id || '')
                      }}
                      style={{padding: '4px', borderRadius: '4px', border: '1px solid #ddd', width: '100%'}}
                    >
                      <option value="">선택</option>
                      {mainCategories.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{padding: '8px'}}>
                    <select
                      value={t.selectedCategory}
                      onChange={e => handleCategoryChange(t.id, e.target.value)}
                      style={{padding: '4px', borderRadius: '4px', border: '1px solid #ddd', width: '100%'}}
                      disabled={!selectedMain}
                    >
                      <option value="">선택</option>
                      {getSubCategories(selectedMain).map(c => (
                        <option key={c.id} value={c.id}>{c.sub_category}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Categorize