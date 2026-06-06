import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Assets() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const assetStructure = [
    { type: 'fixed', main: '부동산', subs: ['아파트', '전세 보증금'] },
    { type: 'fixed', main: '노후/연금', subs: ['남편개인연금', '아내개인연금', '남편퇴직연금', '아내퇴직연금', '남편관리통장'] },
    { type: 'liquid', main: '저축/투자', subs: ['예적금', 'RS딜', '키움주식', '하나주식', '비상금통장'] },
    { type: 'debt', main: '대출', subs: ['주택담보대출', '친정론/시댁론', '마이너스통장', '신용대출'] },
  ]

  useEffect(() => {
    fetchData()
  }, [year, month])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('year', year)
      .eq('month', month)

    const dataMap = {}
    ;(data || []).forEach(a => { dataMap[`${a.asset_type}-${a.sub_category}`] = a })

    const filled = assetStructure.flatMap(group =>
      group.subs.map(sub => ({
        asset_type: group.type,
        main_category: group.main,
        sub_category: sub,
        amount: dataMap[`${group.type}-${sub}`]?.amount || 0,
        id: dataMap[`${group.type}-${sub}`]?.id || null,
      }))
    )
    setAssets(filled)
    setLoading(false)
  }

  function handleChange(sub, value) {
    setAssets(prev =>
      prev.map(a => a.sub_category === sub ? { ...a, amount: value } : a)
    )
  }

  async function handleSave() {
    setSaving(true)
    for (const a of assets) {
      const row = {
        year,
        month,
        asset_type: a.asset_type,
        main_category: a.main_category,
        sub_category: a.sub_category,
        amount: parseInt(a.amount) || 0,
      }
      if (a.id) {
        await supabase.from('assets').update(row).eq('id', a.id)
      } else {
        await supabase.from('assets').insert(row)
      }
    }
    setEditing(false)
    await fetchData()
    setSaving(false)
  }

  const fixed = assets.filter(a => a.asset_type === 'fixed').reduce((s, a) => s + (parseInt(a.amount) || 0), 0)
  const liquid = assets.filter(a => a.asset_type === 'liquid').reduce((s, a) => s + (parseInt(a.amount) || 0), 0)
  const debt = assets.filter(a => a.asset_type === 'debt').reduce((s, a) => s + (parseInt(a.amount) || 0), 0)
  const total = fixed + liquid
  const net = total + debt

  const groups = [...new Map(assetStructure.map(g => [g.main, g])).values()]

  return (
    <div style={{maxWidth: '700px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
        <h2 style={{margin: 0}}>자산 현황</h2>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} style={{padding: '6px', borderRadius: '4px', border: '1px solid #ddd'}}>
          {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          style={{marginLeft: 'auto', padding: '8px 20px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}}
        >
          {saving ? '저장 중...' : editing ? '저장' : '수정'}
        </button>
      </div>

      {loading ? <div>불러오는 중...</div> : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px'}}>
            {[
              { label: '총자산', value: total, color: '#333' },
              { label: '부동자산', value: fixed, color: '#4f46e5' },
              { label: '유동자산', value: liquid, color: '#22c55e' },
              { label: '순자산', value: net, color: '#f43f5e' },
            ].map(item => (
              <div key={item.label} style={{background: '#f9fafb', borderRadius: '8px', padding: '16px'}}>
                <div style={{fontSize: '12px', color: '#666', marginBottom: '6px'}}>{item.label}</div>
                <div style={{fontSize: '15px', fontWeight: '600', color: item.color}}>
                  {(item.value / 100000000).toFixed(2)}억
                </div>
              </div>
            ))}
          </div>

          {groups.map(group => (
            <div key={group.main} style={{marginBottom: '24px'}}>
              <h3 style={{fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: '600'}}>
                {group.main}
                {group.type === 'debt' && <span style={{color: '#f43f5e'}}> (부채)</span>}
              </h3>
              {assets.filter(a => a.main_category === group.main).map(a => (
                <div key={a.sub_category} style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px'}}>
                  <span style={{width: '140px', fontSize: '14px'}}>{a.sub_category}</span>
                  {editing ? (
                    <input
                      type="number"
                      value={a.amount}
                      onChange={e => handleChange(a.sub_category, e.target.value)}
                      style={{width: '160px', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right'}}
                    />
                  ) : (
                    <span style={{fontSize: '14px', color: group.type === 'debt' ? '#f43f5e' : '#333'}}>
                      {parseInt(a.amount).toLocaleString()}원
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default Assets