import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

function Assets() {
  const [latestAssets, setLatestAssets] = useState([])
  const [trendData, setTrendData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editMonth, setEditMonth] = useState(new Date().getMonth() + 1)
  const [editAssets, setEditAssets] = useState([])
  const [prevAssets, setPrevAssets] = useState([])
  const [alerts, setAlerts] = useState([])

  const year = new Date().getFullYear()

  const assetStructure = [
    { type: 'fixed', main: '부동산', subs: ['아파트', '전세 보증금'] },
    { type: 'fixed', main: '노후/연금', subs: ['남편개인연금', '아내개인연금', '남편퇴직연금', '아내퇴직연금', '남편관리통장'] },
    { type: 'liquid', main: '저축/투자', subs: ['예적금', 'RS딜', '키움주식', '하나주식', '비상금통장'] },
    { type: 'debt', main: '대출', subs: ['주택담보대출', '친정론/시댁론', '마이너스통장', '신용대출'] },
  ]

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('year', year)
      .order('month', { ascending: true })

    const allData = data || []
    const months = [...new Set(allData.map(a => a.month))].sort((a, b) => b - a)
    const latestMonth = months[0]
    const latest = allData.filter(a => a.month === latestMonth)
    setLatestAssets(latest)

    const trend = months.reverse().map(m => {
      const monthData = allData.filter(a => a.month === m)
      const fixed = monthData.filter(a => a.asset_type === 'fixed').reduce((s, a) => s + a.amount, 0)
      const liquid = monthData.filter(a => a.asset_type === 'liquid').reduce((s, a) => s + a.amount, 0)
      const debt = monthData.filter(a => a.asset_type === 'debt').reduce((s, a) => s + a.amount, 0)
      return {
        month: `${m}월`,
        순자산: Math.round((fixed + liquid + debt) / 10000),
        총자산: Math.round((fixed + liquid) / 10000),
      }
    })
    setTrendData(trend)
    setLoading(false)
  }

  async function startEditing() {
    const currentMonth = new Date().getMonth() + 1
    setEditMonth(currentMonth)

    const { data: currentData } = await supabase
      .from('assets').select('*').eq('year', year).eq('month', currentMonth)

    let sourceData = currentData || []
    if (sourceData.length === 0) {
      const { data: latestData } = await supabase
        .from('assets').select('*').eq('year', year).order('month', { ascending: false }).limit(50)
      const latestMonth = latestData?.[0]?.month
      sourceData = latestData?.filter(a => a.month === latestMonth) || []
    }

    const dataMap = {}
    sourceData.forEach(a => { dataMap[`${a.asset_type}-${a.sub_category}`] = a })

    const filled = assetStructure.flatMap(group =>
      group.subs.map(sub => ({
        asset_type: group.type,
        main_category: group.main,
        sub_category: sub,
        prevAmount: dataMap[`${group.type}-${sub}`]?.amount || 0,
        amount: dataMap[`${group.type}-${sub}`]?.amount || 0,
        id: (currentData || []).find(a => a.sub_category === sub)?.id || null,
      }))
    )
    setPrevAssets(filled)
    setEditAssets(filled)
    setAlerts([])
    setEditing(true)
  }

  function handleChange(sub, value) {
    const updated = editAssets.map(a => a.sub_category === sub ? { ...a, amount: value } : a)
    setEditAssets(updated)

    // 10% 이상 변경 감지
    const item = updated.find(a => a.sub_category === sub)
    const prev = parseInt(item.prevAmount) || 0
    const curr = parseInt(value) || 0
    if (prev > 0 && Math.abs((curr - prev) / prev) >= 0.1) {
      const pct = (((curr - prev) / prev) * 100).toFixed(1)
      setAlerts(prev => {
        const filtered = prev.filter(a => a.sub !== sub)
        return [...filtered, { sub, pct }]
      })
    } else {
      setAlerts(prev => prev.filter(a => a.sub !== sub))
    }
  }

  async function handleSave() {
    setSaving(true)
    for (const a of editAssets) {
      const row = {
        year, month: editMonth,
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
    setAlerts([])
    await fetchData()
    setSaving(false)
  }

  const fixed = latestAssets.filter(a => a.asset_type === 'fixed').reduce((s, a) => s + a.amount, 0)
  const liquid = latestAssets.filter(a => a.asset_type === 'liquid').reduce((s, a) => s + a.amount, 0)
  const debt = latestAssets.filter(a => a.asset_type === 'debt').reduce((s, a) => s + a.amount, 0)
  const total = fixed + liquid
  const net = total + debt

  const groups = [...new Map(assetStructure.map(g => [g.main, g])).values()]

  if (loading) return <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>자산 현황</h2>
        {!editing && (
          <button className="btn btn-secondary" onClick={startEditing}>이번 달 업데이트</button>
        )}
      </div>

      {!editing ? (
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
                <div className="value" style={{color: item.color, fontSize: '20px'}}>
                  {(item.value / 100000000).toFixed(2)}억
                </div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginTop: '4px'}}>
                  {item.value.toLocaleString()}원
                </div>
              </div>
            ))}
          </div>

          {trendData.length > 1 && (
            <div className="card" style={{marginBottom: '24px'}}>
              <h3 style={{marginBottom: '20px'}}>순자산 트렌드</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{fontSize: 13}} />
                  <YAxis tickFormatter={v => `${(v/10000).toFixed(0)}억`} tick={{fontSize: 12}} />
                  <Tooltip formatter={v => `${v.toLocaleString()}만원`} />
                  <Line type="monotone" dataKey="순자산" stroke="#3182f6" strokeWidth={2.5} dot={{r: 4}} />
                  <Line type="monotone" dataKey="총자산" stroke="#00b493" strokeWidth={2} dot={{r: 3}} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
            {groups.map(group => (
              <div key={group.main} className="card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <h3>{group.main}</h3>
                  {group.type === 'debt' && <span className="badge badge-warning">부채</span>}
                </div>
                {latestAssets.filter(a => a.main_category === group.main).map(a => (
                  <div key={a.sub_category} style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                    <span style={{fontSize: '14px', color: '#8b95a1'}}>{a.sub_category}</span>
                    <span style={{fontSize: '14px', fontWeight: '600', color: group.type === 'debt' ? '#f04452' : '#191f28'}}>
                      {a.amount.toLocaleString()}원
                    </span>
                  </div>
                ))}
                <div style={{borderTop: '1px solid #e8ebed', paddingTop: '10px', display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{fontSize: '13px', color: '#8b95a1', fontWeight: '600'}}>소계</span>
                  <span style={{fontSize: '14px', fontWeight: '700', color: group.type === 'debt' ? '#f04452' : '#3182f6'}}>
                    {latestAssets.filter(a => a.main_category === group.main).reduce((s, a) => s + a.amount, 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="card">
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <h3>{editMonth}월 자산 업데이트</h3>
            </div>
            <div style={{display: 'flex', gap: '8px'}}>
              <button className="btn btn-secondary" onClick={() => { setEditing(false); setAlerts([]) }}>취소</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>

          {alerts.length > 0 && (
            <div style={{background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px'}}>
              {alerts.map(a => (
                <div key={a.sub} style={{fontSize: '14px', color: '#ff8c00', fontWeight: '500'}}>
                  ⚠ {a.sub}이(가) 기존 대비 {a.pct}% 변경됐어요. 확인해주세요.
                </div>
              ))}
            </div>
          )}

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px', padding: '0 0 8px', borderBottom: '1px solid #e8ebed'}}>
            <span style={{fontSize: '12px', fontWeight: '600', color: '#8b95a1'}}>항목</span>
            <span style={{fontSize: '12px', fontWeight: '600', color: '#8b95a1', textAlign: 'right'}}>기존</span>
            <span style={{fontSize: '12px', fontWeight: '600', color: '#8b95a1', textAlign: 'right'}}>이번 달</span>
          </div>

          {groups.map(group => (
            <div key={group.main} style={{marginBottom: '24px'}}>
              <div className="section-title" style={{marginBottom: '10px'}}>{group.main}</div>
              {editAssets.filter(a => a.main_category === group.main).map(a => {
                const hasAlert = alerts.find(al => al.sub === a.sub_category)
                const curr = parseInt(a.amount) || 0
                const prev = parseInt(a.prevAmount) || 0
                const diff = curr - prev

                return (
                  <div key={a.sub_category} style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '8px',
                    alignItems: 'center',
                    marginBottom: '10px',
                    padding: '8px',
                    borderRadius: '8px',
                    background: hasAlert ? '#fff7e6' : 'transparent',
                  }}>
                    <span style={{fontSize: '14px', color: '#191f28'}}>{a.sub_category}</span>
                    <div style={{textAlign: 'right'}}>
                      <div style={{fontSize: '14px', color: '#8b95a1'}}>{prev.toLocaleString()}원</div>
                      {diff !== 0 && (
                        <div style={{fontSize: '11px', color: diff > 0 ? '#00b493' : '#f04452'}}>
                          {diff > 0 ? '+' : ''}{diff.toLocaleString()}원
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      value={a.amount}
                      onChange={e => handleChange(a.sub_category, e.target.value)}
                      style={{textAlign: 'right', border: hasAlert ? '1.5px solid #ff8c00' : undefined}}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Assets