import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('assets').select('*').eq('year', year).eq('month', month)

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
    setAssets(prev => prev.map(a => a.sub_category === sub ? { ...a, amount: value } : a))
  }

  async function handleSave() {
    setSaving(true)
    for (const a of assets) {
      const row = {
        year, month,
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
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>자산 현황</h2>
        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
          {editing ? (
            <div style={{display: 'flex', gap: '8px'}}>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setEditing(true)}>수정</button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>
      ) : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px'}}>
            {[
              { label: '순자산', value: net, color: '#3182f6' },
              { label: '총자산', value: total, color: '#191f28' },
              { label: '부동자산', value: fixed, color: '#7c3aed' },
              { label: '유동자산', value: liquid, color: '#00b493' },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="label">{item.label}</div>
                <div className="value" style={{color: item.color, fontSize: '18px'}}>
                  {(item.value / 100000000).toFixed(2)}억
                </div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginTop: '4px'}}>
                  {item.value.toLocaleString()}원
                </div>
              </div>
            ))}
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            {groups.map(group => (
              <div key={group.main} className="card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <h3>{group.main}</h3>
                  {group.type === 'debt' && (
                    <span className="badge badge-warning">부채</span>
                  )}
                </div>
                {assets.filter(a => a.main_category === group.main).map(a => (
                  <div key={a.sub_category} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
                    <span style={{fontSize: '14px', color: '#8b95a1'}}>{a.sub_category}</span>
                    {editing ? (
                      <input
                        type="number"
                        value={a.amount}
                        onChange={e => handleChange(a.sub_category, e.target.value)}
                        style={{width: '160px', textAlign: 'right'}}
                      />
                    ) : (
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: group.type === 'debt' ? '#f04452' : '#191f28'
                      }}>
                        {parseInt(a.amount).toLocaleString()}원
                      </span>
                    )}
                  </div>
                ))}
                <div style={{borderTop: '1px solid #e8ebed', paddingTop: '10px', display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{fontSize: '13px', fontWeight: '600', color: '#8b95a1'}}>소계</span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: group.type === 'debt' ? '#f04452' : '#3182f6'
                  }}>
                    {assets.filter(a => a.main_category === group.main).reduce((s, a) => s + (parseInt(a.amount) || 0), 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default Assets