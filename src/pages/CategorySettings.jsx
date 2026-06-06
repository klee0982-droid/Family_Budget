import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function CategorySettings() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('expense')
  const [newMain, setNewMain] = useState('')
  const [newSub, setNewSub] = useState('')
  const [selectedMain, setSelectedMain] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [tab])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('type', tab)
      .order('sort_order')
    setCategories(data || [])
    setLoading(false)
  }

  const mainCategories = [...new Set(categories.map(c => c.main_category))]

  async function handleAddCategory() {
    if (!newMain || !newSub) {
      alert('대분류와 소분류를 모두 입력해주세요.')
      return
    }
    setSaving(true)
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) : 0
    const { error } = await supabase.from('categories').insert({
      type: tab,
      main_category: newMain,
      sub_category: newSub,
      sort_order: maxOrder + 1,
    })
    if (error) {
      alert('추가 실패: ' + error.message)
    } else {
      setNewMain('')
      setNewSub('')
      await fetchData()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('삭제할까요? 이미 이 카테고리로 분류된 내역은 미분류로 변경돼요.')) return
    await supabase.from('categories').delete().eq('id', id)
    await fetchData()
  }

  const typeLabel = { expense: '지출', income: '수입', saving: '저축' }

  return (
    <div>
      <h2 style={{marginBottom: '24px'}}>카테고리 관리</h2>

      <div style={{display: 'flex', gap: '8px', marginBottom: '24px'}}>
        {['expense', 'income', 'saving'].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedMain('') }}
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
            {typeLabel[t]}
          </button>
        ))}
      </div>

      {/* 새 카테고리 추가 */}
      <div className="card" style={{marginBottom: '20px'}}>
        <h3 style={{marginBottom: '16px'}}>새 카테고리 추가</h3>
        <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap'}}>
          <div>
            <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>대분류</div>
            <div style={{display: 'flex', gap: '6px'}}>
              <select
                value={newMain}
                onChange={e => setNewMain(e.target.value)}
                style={{width: '130px'}}
              >
                <option value="">기존 선택</option>
                {mainCategories.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span style={{fontSize: '13px', color: '#8b95a1', alignSelf: 'center'}}>또는</span>
              <input
                type="text"
                placeholder="새로 입력"
                value={newMain}
                onChange={e => setNewMain(e.target.value)}
                style={{width: '120px'}}
              />
            </div>
          </div>
          <div>
            <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>소분류</div>
            <input
              type="text"
              placeholder="소분류명 입력"
              value={newSub}
              onChange={e => setNewSub(e.target.value)}
              style={{width: '160px'}}
            />
          </div>
          <button
            onClick={handleAddCategory}
            disabled={saving}
            className="btn btn-primary"
          >
            + 추가
          </button>
        </div>
      </div>

      {/* 카테고리 목록 */}
      {loading ? (
        <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0'}}>불러오는 중...</div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px'}}>
          {mainCategories.map(main => (
            <div key={main} className="card">
              <div style={{
                fontSize: '13px',
                fontWeight: '700',
                color: '#8b95a1',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '1px solid #e8ebed',
              }}>
                {main}
              </div>
              {categories.filter(c => c.main_category === main).map(c => (
                <div key={c.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid #f2f4f6',
                }}>
                  <span style={{fontSize: '14px', color: '#191f28'}}>{c.sub_category}</span>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #f04452',
                      background: 'white',
                      color: '#f04452',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CategorySettings