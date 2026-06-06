import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Categorize() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [])

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
      await supabase.from('transactions').update({ category_id: t.selectedCategory }).eq('id', t.id)
    }
    await fetchData()
    setSaving(false)
  }

  const categorizedCount = transactions.filter(t => t.selectedCategory).length

  if (loading) return (
    <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>
  )

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <div>
          <h2 style={{marginBottom: '4px'}}>카테고리 분류</h2>
          <p style={{fontSize: '14px', color: '#8b95a1'}}>
            {transactions.length}건 중 {categorizedCount}건 분류됨
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || categorizedCount === 0}
        >
          {saving ? '저장 중...' : `${categorizedCount}건 저장`}
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="card" style={{textAlign: 'center', padding: '60px'}}>
          <div style={{fontSize: '40px', marginBottom: '12px'}}>✅</div>
          <p style={{color: '#8b95a1', fontSize: '14px'}}>분류할 거래가 없어요. 카드내역을 먼저 업로드해주세요!</p>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>가맹점</th>
                <th style={{textAlign: 'right'}}>금액</th>
                <th>대분류</th>
                <th>소분류</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => {
                const selectedMain = categories.find(c => c.id === t.selectedCategory)?.main_category || ''
                return (
                  <tr key={t.id}>
                    <td style={{color: '#8b95a1', fontSize: '13px'}}>{t.date}</td>
                    <td style={{fontWeight: '500'}}>{t.merchant}</td>
                    <td style={{textAlign: 'right', fontWeight: '600'}}>{t.amount.toLocaleString()}원</td>
                    <td>
                      <select
                        value={selectedMain}
                        onChange={e => {
                          const firstSub = getSubCategories(e.target.value)[0]
                          handleCategoryChange(t.id, firstSub?.id || '')
                        }}
                        style={{width: '100%', fontSize: '13px'}}
                      >
                        <option value="">선택</option>
                        {mainCategories.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={t.selectedCategory}
                        onChange={e => handleCategoryChange(t.id, e.target.value)}
                        disabled={!selectedMain}
                        style={{width: '100%', fontSize: '13px'}}
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
        </div>
      )}
    </div>
  )
}

export default Categorize