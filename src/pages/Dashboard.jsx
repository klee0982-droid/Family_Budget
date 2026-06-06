import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function Dashboard() {
  const [year] = useState(new Date().getFullYear())
  const [latestMonth, setLatestMonth] = useState(null)
  const [summary, setSummary] = useState({ income: 0, expense: 0, saving: 0 })
  const [topExpenses, setTopExpenses] = useState([])
  const [trendData, setTrendData] = useState([])
  const [netAsset, setNetAsset] = useState(0)
  const [uncategorized, setUncategorized] = useState(0)
  const [loading, setLoading] = useState(true)
  const [aiComment, setAiComment] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [yearlyStats, setYearlyStats] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    const [{ data: allInc }, { data: allTx }, { data: allSav }, { data: assets }] = await Promise.all([
      supabase.from('incomes').select('month, amount').eq('year', year),
      supabase.from('transactions').select('month, amount, category_id, categories(main_category, sub_category)').eq('year', year),
      supabase.from('savings').select('month, amount').eq('year', year),
      supabase.from('assets').select('*').eq('year', year).order('month', { ascending: false }).limit(50),
    ])

    // 데이터가 있는 가장 최근 월 찾기
    const incMonths = [...new Set((allInc || []).map(r => r.month))]
    const txMonths = [...new Set((allTx || []).map(r => r.month))]
    const savMonths = [...new Set((allSav || []).map(r => r.month))]
    const allMonths = [...new Set([...incMonths, ...txMonths, ...savMonths])].sort((a, b) => b - a)
    const latest = allMonths[0] || new Date().getMonth() + 1
    setLatestMonth(latest)

    // 최근 월 요약
    const totalIncome = (allInc || []).filter(r => r.month === latest).reduce((s, r) => s + r.amount, 0)
    const totalExpense = (allTx || []).filter(r => r.month === latest).reduce((s, r) => s + r.amount, 0)
    const totalSaving = (allSav || []).filter(r => r.month === latest).reduce((s, r) => s + r.amount, 0)
    setSummary({ income: totalIncome, expense: totalExpense, saving: totalSaving })

    // 미분류
    setUncategorized((allTx || []).filter(t => t.month === latest && !t.category_id).length)

    // 카테고리별 지출 top3
    const catMap = {}
    ;(allTx || []).filter(t => t.month === latest && t.category_id).forEach(t => {
      const name = t.categories?.main_category || '기타'
      catMap[name] = (catMap[name] || 0) + t.amount
    })
    setTopExpenses(Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, value]) => ({ name, value })))

    // 순자산
    const assetMonths = [...new Set((assets || []).map(a => a.month))].sort((a, b) => b - a)
    const latestAssetMonth = assetMonths[0]
    const latestAssets = (assets || []).filter(a => a.month === latestAssetMonth)
    setNetAsset(latestAssets.reduce((s, a) => s + a.amount, 0))

    // 연간 트렌드
    const trend = Array.from({ length: latest }, (_, i) => {
      const m = i + 1
      const inc = (allInc || []).filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)
      const exp = (allTx || []).filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)
      const sav = (allSav || []).filter(r => r.month === m).reduce((s, r) => s + r.amount, 0)
      return { month: `${m}월`, 수입: Math.round(inc / 10000), 지출: Math.round(exp / 10000), 저축: Math.round(sav / 10000), savingRate: inc > 0 ? parseFloat(((inc - exp) / inc * 100).toFixed(1)) : 0 }
    })
    setTrendData(trend)

    // 연간 통계
    const totalYearIncome = (allInc || []).reduce((s, r) => s + r.amount, 0)
    const totalYearExpense = (allTx || []).reduce((s, r) => s + r.amount, 0)
    const totalYearSaving = (allSav || []).reduce((s, r) => s + r.amount, 0)
    const avgSavingRate = totalYearIncome > 0 ? ((totalYearIncome - totalYearExpense) / totalYearIncome * 100).toFixed(1) : 0
    setYearlyStats({ income: totalYearIncome, expense: totalYearExpense, saving: totalYearSaving, avgSavingRate })

    setLoading(false)
  }

  async function generateComment() {
    if (!latestMonth) return
    setAiLoading(true)
    const savingRate = summary.income > 0 ? ((summary.income - summary.expense) / summary.income * 100).toFixed(1) : 0
    const topStr = topExpenses.map(t => `${t.name} ${t.value.toLocaleString()}원`).join(', ')
    const trendStr = trendData.map(t => `${t.month}: 수입 ${t.수입}만원, 지출 ${t.지출}만원, 저축률 ${t.savingRate}%`).join(' / ')

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: '당신은 가계부 AI 어시스턴트입니다. 주어진 재무 데이터를 바탕으로 따뜻하고 친근한 한국어로 3~4문장의 코멘트를 작성해주세요. 최근 월 현황과 연간 흐름을 모두 언급하고, 구체적인 수치를 포함해주세요. 이모지를 1~2개 사용해도 좋아요.',
          messages: [{
            role: 'user',
            content: `${year}년 재무 현황 분석 요청:

[${latestMonth}월 현황 (가장 최근)]
- 수입: ${summary.income.toLocaleString()}원
- 지출: ${summary.expense.toLocaleString()}원
- 저축: ${summary.saving.toLocaleString()}원
- 저축률: ${savingRate}%
- 지출 상위 카테고리: ${topStr || '데이터 없음'}

[연간 흐름 (1월~${latestMonth}월)]
${trendStr}

[연간 합계]
- 총 수입: ${yearlyStats.income?.toLocaleString()}원
- 총 지출: ${yearlyStats.expense?.toLocaleString()}원
- 평균 저축률: ${yearlyStats.avgSavingRate}%
- 순자산: ${(netAsset / 100000000).toFixed(2)}억원

최근 월 현황과 연간 흐름을 모두 언급해서 코멘트 작성해주세요.`
          }]
        })
      })
      const data = await response.json()
      setAiComment(data.content[0].text)
    } catch (err) {
      setAiComment('코멘트를 불러오는 데 실패했어요.')
    }
    setAiLoading(false)
  }

  const savingRate = summary.income > 0 ? ((summary.income - summary.expense) / summary.income * 100).toFixed(1) : 0

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <div>
          <h2 style={{marginBottom: '4px'}}>{year}년 {latestMonth}월 Overview</h2>
          <p style={{fontSize: '14px', color: '#8b95a1'}}>데이터가 있는 가장 최근 월 기준이에요</p>
        </div>
      </div>

      {loading ? (
        <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>
      ) : (
        <>
          {/* AI 코멘트 */}
          <div className="card" style={{marginBottom: '24px', background: 'linear-gradient(135deg, #ebf3fe 0%, #f0f7ff 100%)', border: '1px solid #c3d9fd'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px'}}>
              <div style={{flex: 1}}>
                <div style={{fontSize: '12px', fontWeight: '600', color: '#3182f6', marginBottom: '8px'}}>✨ AI 재무 코멘트</div>
                {aiComment ? (
                  <p style={{fontSize: '14px', color: '#191f28', lineHeight: '1.7', whiteSpace: 'pre-wrap'}}>{aiComment}</p>
                ) : (
                  <p style={{fontSize: '14px', color: '#8b95a1'}}>{latestMonth}월 현황과 연간 흐름을 함께 분석해드려요</p>
                )}
              </div>
              <button
                onClick={generateComment}
                disabled={aiLoading}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: '#3182f6', color: 'white', fontSize: '13px',
                  fontWeight: '600', cursor: 'pointer', flexShrink: 0,
                  opacity: aiLoading ? 0.7 : 1,
                }}
              >
                {aiLoading ? '분석 중...' : aiComment ? '재분석' : '분석하기'}
              </button>
            </div>
          </div>

          {uncategorized > 0 && (
            <div style={{background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#ff8c00', fontWeight: '500'}}>
              ⚠ 미분류 거래 {uncategorized}건이 있어요. 카테고리 분류 페이지에서 분류해주세요.
            </div>
          )}

          {/* 최근 월 요약 */}
          <div style={{marginBottom: '8px'}}>
            <div className="section-title">{latestMonth}월 현황</div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px'}}>
            {[
              { label: '수입', value: summary.income, color: '#00b493' },
              { label: '지출', value: summary.expense, color: '#f04452' },
              { label: '저축', value: summary.saving, color: '#3182f6' },
              { label: '저축률', value: savingRate + '%', color: parseFloat(savingRate) >= 0 ? '#00b493' : '#f04452', isRate: true },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="label">{item.label}</div>
                <div className="value" style={{color: item.color}}>
                  {item.isRate ? item.value : item.value.toLocaleString() + '원'}
                </div>
              </div>
            ))}
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px'}}>
            {/* 지출 top3 */}
            <div className="card">
              <h3 style={{marginBottom: '16px'}}>{latestMonth}월 지출 Top 3</h3>
              {topExpenses.length === 0 ? (
                <p style={{color: '#b0b8c1', fontSize: '13px', textAlign: 'center', padding: '16px 0'}}>데이터가 없어요</p>
              ) : topExpenses.map((item, i) => (
                <div key={item.name} style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px'}}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                    background: ['#3182f6', '#00b493', '#f04452'][i],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: '700', color: 'white',
                  }}>{i + 1}</div>
                  <span style={{flex: 1, fontSize: '14px', color: '#191f28'}}>{item.name}</span>
                  <span style={{fontSize: '14px', fontWeight: '600', color: '#f04452'}}>{item.value.toLocaleString()}원</span>
                </div>
              ))}
            </div>

            {/* 순자산 + 연간 요약 */}
            <div className="card">
              <h3 style={{marginBottom: '16px'}}>연간 요약</h3>
              <div style={{marginBottom: '16px'}}>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>순자산</div>
                <div style={{fontSize: '24px', fontWeight: '700', color: '#3182f6'}}>{(netAsset / 100000000).toFixed(2)}억</div>
              </div>
              {yearlyStats && (
                <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                  {[
                    { label: '연간 총 수입', value: yearlyStats.income, color: '#00b493' },
                    { label: '연간 총 지출', value: yearlyStats.expense, color: '#f04452' },
                    { label: '평균 저축률', value: yearlyStats.avgSavingRate + '%', color: '#7c3aed', isRate: true },
                  ].map(item => (
                    <div key={item.label} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <span style={{fontSize: '13px', color: '#8b95a1'}}>{item.label}</span>
                      <span style={{fontSize: '13px', fontWeight: '600', color: item.color}}>
                        {item.isRate ? item.value : item.value?.toLocaleString() + '원'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 연간 트렌드 */}
          {trendData.length > 1 && (
            <div className="card">
              <h3 style={{marginBottom: '20px'}}>{year}년 수입 / 지출 트렌드</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <XAxis dataKey="month" tick={{fontSize: 12}} />
                  <YAxis tickFormatter={v => `${v}만`} tick={{fontSize: 12}} />
                  <Tooltip formatter={(v, name) => [`${v.toLocaleString()}만원`, name]} />
                  <Line type="monotone" dataKey="수입" stroke="#00b493" strokeWidth={2} dot={{r: 3}} />
                  <Line type="monotone" dataKey="지출" stroke="#f04452" strokeWidth={2} dot={{r: 3}} />
                  <Line type="monotone" dataKey="저축" stroke="#3182f6" strokeWidth={2} dot={{r: 3}} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard