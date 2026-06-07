import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const defaultMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth()
const defaultYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()

function Investments() {
  const [investments, setInvestments] = useState([])
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('dashboard') // 'dashboard' | 'list' | 'returns'
  const [year, setYear] = useState(defaultYear)
  const [month, setMonth] = useState(defaultMonth)

  // 투자 추가/수정
  const [showInvestForm, setShowInvestForm] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState(null)
  const [investForm, setInvestForm] = useState({
    name: '', principal: '', start_date: '', end_date: '',
    rate: '', rate_type: 'monthly', memo: '', is_active: true
  })

  // 수익 입력
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [selectedInvestment, setSelectedInvestment] = useState(null)
  const [returnForm, setReturnForm] = useState({
    monthly_interest: '', cashback: '', maturity_reward: '', memo: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const [{ data: inv }, { data: ret }] = await Promise.all([
      supabase.from('investments').select('*').order('created_at', { ascending: false }),
      supabase.from('investment_returns').select('*, investments(name)').eq('year', year).eq('month', month),
    ])
    setInvestments(inv || [])
    setReturns(ret || [])
    setLoading(false)
  }

  async function fetchAllReturns() {
    const { data } = await supabase
      .from('investment_returns')
      .select('*, investments(name)')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
    return data || []
  }

  const activeInvestments = investments.filter(i => i.is_active)
  const totalPrincipal = activeInvestments.reduce((s, i) => s + i.principal, 0)
  const monthlyTotal = returns.reduce((s, r) => s + r.monthly_interest + r.cashback + r.maturity_reward, 0)
  const monthlyInterest = returns.reduce((s, r) => s + r.monthly_interest, 0)
  const monthlyExtra = returns.reduce((s, r) => s + r.cashback + r.maturity_reward, 0)

  function startAddInvestment() {
    setEditingInvestment(null)
    setInvestForm({ name: '', principal: '', start_date: '', end_date: '', rate: '', rate_type: 'monthly', memo: '', is_active: true })
    setShowInvestForm(true)
  }

  function startEditInvestment(inv) {
    setEditingInvestment(inv)
    setInvestForm({
      name: inv.name, principal: inv.principal, start_date: inv.start_date || '',
      end_date: inv.end_date || '', rate: inv.rate || '', rate_type: inv.rate_type || 'monthly',
      memo: inv.memo || '', is_active: inv.is_active
    })
    setShowInvestForm(true)
  }

  async function handleSaveInvestment() {
    if (!investForm.name || !investForm.principal || !investForm.start_date) {
      alert('투자명, 투자금, 시작일은 필수예요.')
      return
    }
    setSaving(true)
    const row = {
      name: investForm.name,
      principal: parseInt(investForm.principal),
      start_date: investForm.start_date,
      end_date: investForm.end_date || null,
      rate: investForm.rate ? parseFloat(investForm.rate) : null,
      rate_type: investForm.rate_type,
      memo: investForm.memo || null,
      is_active: investForm.is_active,
    }
    if (editingInvestment) {
      await supabase.from('investments').update(row).eq('id', editingInvestment.id)
    } else {
      await supabase.from('investments').insert(row)
    }
    setShowInvestForm(false)
    await fetchData()
    setSaving(false)
  }

  async function handleDeleteInvestment(id) {
    if (!window.confirm('투자 항목을 삭제할까요? 관련 수익 내역도 모두 삭제돼요.')) return
    await supabase.from('investments').delete().eq('id', id)
    await fetchData()
  }

  async function toggleActive(inv) {
    await supabase.from('investments').update({ is_active: !inv.is_active }).eq('id', inv.id)
    await fetchData()
  }

  function startAddReturn(inv) {
    setSelectedInvestment(inv)
    const existing = returns.find(r => r.investment_id === inv.id)
    setReturnForm({
      monthly_interest: existing?.monthly_interest || '',
      cashback: existing?.cashback || '',
      maturity_reward: existing?.maturity_reward || '',
      memo: existing?.memo || '',
    })
    setShowReturnForm(true)
  }

  async function handleSaveReturn() {
    setSaving(true)
    const row = {
      investment_id: selectedInvestment.id,
      year, month,
      monthly_interest: parseInt(returnForm.monthly_interest) || 0,
      cashback: parseInt(returnForm.cashback) || 0,
      maturity_reward: parseInt(returnForm.maturity_reward) || 0,
      memo: returnForm.memo || null,
    }
    await supabase.from('investment_returns').upsert(row, { onConflict: 'investment_id,year,month' })
    setShowReturnForm(false)
    await fetchData()
    setSaving(false)
  }

  function calcMonthlyInterest(inv) {
    if (!inv.rate || !inv.principal) return 0
    if (inv.rate_type === 'monthly') return Math.round(inv.principal * inv.rate / 100)
    if (inv.rate_type === 'yearly') return Math.round(inv.principal * inv.rate / 100 / 12)
    return 0
  }

  function calcDaysLeft(endDate) {
    if (!endDate) return null
    const diff = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
    return diff
  }

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>투자 관리</h2>
        <button className="btn btn-primary" onClick={startAddInvestment}>+ 투자 추가</button>
      </div>

      {/* 탭 */}
      <div style={{display: 'flex', gap: '8px', marginBottom: '24px'}}>
        {['dashboard', 'list', 'returns'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '8px 20px', borderRadius: '10px', border: 'none',
            fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            background: view === v ? '#3182f6' : '#f2f4f6',
            color: view === v ? 'white' : '#8b95a1',
          }}>
            {v === 'dashboard' ? '대시보드' : v === 'list' ? '투자 목록' : '수익 입력'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0'}}>불러오는 중...</div>
      ) : view === 'dashboard' ? (
        <div>
          {/* 요약 카드 */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px'}}>
            {[
              { label: '총 투자금', value: totalPrincipal.toLocaleString() + '원', color: '#3182f6' },
              { label: '진행중 딜', value: activeInvestments.length + '개', color: '#7c3aed' },
              { label: `${month}월 총 수익`, value: monthlyTotal.toLocaleString() + '원', color: '#00b493' },
              { label: `${month}월 추가 수익`, value: monthlyExtra.toLocaleString() + '원', color: '#ff8c00' },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <div className="label">{item.label}</div>
                <div className="value" style={{color: item.color, fontSize: '18px'}}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* 월 선택 */}
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px'}}>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>

          {/* 활성 투자 목록 + 이번달 수익 */}
          <div className="card">
            <h3 style={{marginBottom: '16px'}}>{month}월 수익 현황</h3>
            {activeInvestments.length === 0 ? (
              <p style={{color: '#b0b8c1', fontSize: '13px', textAlign: 'center', padding: '24px 0'}}>진행중인 투자가 없어요</p>
            ) : activeInvestments.map(inv => {
              const ret = returns.find(r => r.investment_id === inv.id)
              const expectedInterest = calcMonthlyInterest(inv)
              const actualTotal = ret ? ret.monthly_interest + ret.cashback + ret.maturity_reward : null
              const daysLeft = calcDaysLeft(inv.end_date)
              return (
                <div key={inv.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 0', borderBottom: '1px solid #f2f4f6', flexWrap: 'wrap', gap: '8px'
                }}>
                  <div style={{flex: 1, minWidth: '160px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px'}}>
                      <span style={{fontSize: '14px', fontWeight: '600', color: '#191f28'}}>{inv.name}</span>
                      {inv.rate && (
                        <span className="tag" style={{fontSize: '11px'}}>
                          {inv.rate}% {inv.rate_type === 'monthly' ? '월' : '연'}
                        </span>
                      )}
                      {daysLeft !== null && (
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                          background: daysLeft <= 30 ? '#fff0f0' : '#f0f7ff',
                          color: daysLeft <= 30 ? '#f04452' : '#3182f6',
                          fontWeight: '600'
                        }}>
                          {daysLeft > 0 ? `D-${daysLeft}` : '만기'}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize: '12px', color: '#8b95a1'}}>
                      투자금 {inv.principal.toLocaleString()}원
                      {expectedInterest > 0 && ` · 예상 월이자 ${expectedInterest.toLocaleString()}원`}
                    </div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    {ret ? (
                      <div style={{textAlign: 'right'}}>
                        <div style={{fontSize: '15px', fontWeight: '700', color: '#00b493'}}>{actualTotal.toLocaleString()}원</div>
                        {(ret.cashback > 0 || ret.maturity_reward > 0) && (
                          <div style={{fontSize: '11px', color: '#8b95a1'}}>
                            이자 {ret.monthly_interest.toLocaleString()} + 추가 {(ret.cashback + ret.maturity_reward).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{fontSize: '13px', color: '#b0b8c1'}}>미입력</span>
                    )}
                    <button
                      onClick={() => startAddReturn(inv)}
                      style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid #3182f6', background: 'white', color: '#3182f6', fontSize: '12px', cursor: 'pointer', fontWeight: '600', flexShrink: 0}}
                    >
                      {ret ? '수정' : '입력'}
                    </button>
                  </div>
                </div>
              )
            })}
            {monthlyTotal > 0 && (
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', marginTop: '4px', borderTop: '2px solid #e8ebed'}}>
                <span style={{fontSize: '14px', fontWeight: '600', color: '#8b95a1'}}>총 수익</span>
                <span style={{fontSize: '16px', fontWeight: '700', color: '#00b493'}}>{monthlyTotal.toLocaleString()}원</span>
              </div>
            )}
          </div>
        </div>
      ) : view === 'list' ? (
        <div>
          <div className="card">
            <h3 style={{marginBottom: '16px'}}>전체 투자 목록</h3>
            {investments.length === 0 ? (
              <p style={{color: '#b0b8c1', fontSize: '13px', textAlign: 'center', padding: '24px 0'}}>등록된 투자가 없어요</p>
            ) : investments.map(inv => {
              const daysLeft = calcDaysLeft(inv.end_date)
              const expectedInterest = calcMonthlyInterest(inv)
              return (
                <div key={inv.id} style={{
                  padding: '14px 0', borderBottom: '1px solid #f2f4f6',
                  opacity: inv.is_active ? 1 : 0.5,
                }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px'}}>
                    <div style={{flex: 1, minWidth: '200px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px'}}>
                        <span style={{fontSize: '15px', fontWeight: '600', color: '#191f28'}}>{inv.name}</span>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                          background: inv.is_active ? '#e5faf6' : '#f2f4f6',
                          color: inv.is_active ? '#00b493' : '#8b95a1', fontWeight: '600'
                        }}>
                          {inv.is_active ? '진행중' : '종료'}
                        </span>
                        {daysLeft !== null && inv.is_active && (
                          <span style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                            background: daysLeft <= 30 ? '#fff0f0' : '#f0f7ff',
                            color: daysLeft <= 30 ? '#f04452' : '#3182f6', fontWeight: '600'
                          }}>
                            {daysLeft > 0 ? `D-${daysLeft}` : '만기'}
                          </span>
                        )}
                      </div>
                      <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                        <span style={{fontSize: '13px', color: '#191f28', fontWeight: '500'}}>
                          투자금 <strong>{inv.principal.toLocaleString()}원</strong>
                        </span>
                        {inv.rate && (
                          <span style={{fontSize: '13px', color: '#7c3aed'}}>
                            금리 {inv.rate}% ({inv.rate_type === 'monthly' ? '월' : '연'})
                          </span>
                        )}
                        {expectedInterest > 0 && (
                          <span style={{fontSize: '13px', color: '#00b493'}}>
                            예상 월이자 {expectedInterest.toLocaleString()}원
                          </span>
                        )}
                      </div>
                      <div style={{fontSize: '12px', color: '#8b95a1', marginTop: '4px'}}>
                        {inv.start_date} {inv.end_date ? `~ ${inv.end_date}` : ''}
                        {inv.memo && ` · ${inv.memo}`}
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: '6px', flexShrink: 0}}>
                      <button
                        onClick={() => toggleActive(inv)}
                        style={{padding: '5px 10px', borderRadius: '6px', border: `1px solid ${inv.is_active ? '#f04452' : '#00b493'}`, background: 'white', color: inv.is_active ? '#f04452' : '#00b493', fontSize: '12px', cursor: 'pointer'}}
                      >
                        {inv.is_active ? '종료' : '재개'}
                      </button>
                      <button
                        onClick={() => startEditInvestment(inv)}
                        style={{padding: '5px 10px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', color: '#3182f6', fontSize: '12px', cursor: 'pointer'}}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDeleteInvestment(inv.id)}
                        style={{padding: '5px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', color: '#f04452', fontSize: '12px', cursor: 'pointer'}}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        // 수익 입력 탭
        <div>
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px'}}>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
            </select>
          </div>

          <div className="card">
            <h3 style={{marginBottom: '16px'}}>{year}년 {month}월 수익 입력</h3>
            {activeInvestments.length === 0 ? (
              <p style={{color: '#b0b8c1', fontSize: '13px', textAlign: 'center', padding: '24px 0'}}>진행중인 투자가 없어요</p>
            ) : activeInvestments.map(inv => {
              const ret = returns.find(r => r.investment_id === inv.id)
              return (
                <div key={inv.id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f2f4f6', flexWrap: 'wrap', gap: '8px'}}>
                  <div>
                    <div style={{fontSize: '14px', fontWeight: '600', color: '#191f28'}}>{inv.name}</div>
                    <div style={{fontSize: '12px', color: '#8b95a1'}}>{inv.principal.toLocaleString()}원</div>
                  </div>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    {ret ? (
                      <div style={{fontSize: '13px', color: '#00b493', fontWeight: '600'}}>
                        {(ret.monthly_interest + ret.cashback + ret.maturity_reward).toLocaleString()}원 입력됨
                      </div>
                    ) : (
                      <span style={{fontSize: '13px', color: '#b0b8c1'}}>미입력</span>
                    )}
                    <button
                      onClick={() => startAddReturn(inv)}
                      className="btn btn-primary"
                      style={{padding: '6px 14px', fontSize: '13px'}}
                    >
                      {ret ? '수정' : '입력'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 투자 추가/수정 모달 */}
      {showInvestForm && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: 'white', borderRadius: '16px', padding: '28px', width: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginBottom: '20px'}}>{editingInvestment ? '투자 수정' : '투자 추가'}</h3>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>투자명 *</div>
                <input type="text" placeholder="예: 하나은행 RS딜" value={investForm.name} onChange={e => setInvestForm(p => ({...p, name: e.target.value}))} style={{width: '100%'}} />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>투자금 *</div>
                <input type="number" placeholder="0" value={investForm.principal} onChange={e => setInvestForm(p => ({...p, principal: e.target.value}))} style={{width: '100%', textAlign: 'right'}} />
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                <div>
                  <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>시작일 *</div>
                  <input type="date" value={investForm.start_date} onChange={e => setInvestForm(p => ({...p, start_date: e.target.value}))} style={{width: '100%'}} />
                </div>
                <div>
                  <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>만기일</div>
                  <input type="date" value={investForm.end_date} onChange={e => setInvestForm(p => ({...p, end_date: e.target.value}))} style={{width: '100%'}} />
                </div>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px'}}>
                <div>
                  <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>금리 (%)</div>
                  <input type="number" step="0.01" placeholder="0.00" value={investForm.rate} onChange={e => setInvestForm(p => ({...p, rate: e.target.value}))} style={{width: '100%', textAlign: 'right'}} />
                </div>
                <div>
                  <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>기준</div>
                  <select value={investForm.rate_type} onChange={e => setInvestForm(p => ({...p, rate_type: e.target.value}))} style={{width: '100%'}}>
                    <option value="monthly">월</option>
                    <option value="yearly">연</option>
                  </select>
                </div>
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>비고</div>
                <input type="text" placeholder="메모 (선택)" value={investForm.memo} onChange={e => setInvestForm(p => ({...p, memo: e.target.value}))} style={{width: '100%'}} />
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <input type="checkbox" id="is_active" checked={investForm.is_active} onChange={e => setInvestForm(p => ({...p, is_active: e.target.checked}))} />
                <label htmlFor="is_active" style={{fontSize: '14px', color: '#191f28'}}>진행중</label>
              </div>
            </div>
            <div style={{display: 'flex', gap: '8px', marginTop: '20px'}}>
              <button onClick={() => setShowInvestForm(false)} className="btn btn-secondary" style={{flex: 1}}>취소</button>
              <button onClick={handleSaveInvestment} disabled={saving} className="btn btn-primary" style={{flex: 1}}>{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 수익 입력 모달 */}
      {showReturnForm && selectedInvestment && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: 'white', borderRadius: '16px', padding: '28px', width: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginBottom: '4px'}}>{selectedInvestment.name}</h3>
            <p style={{fontSize: '13px', color: '#8b95a1', marginBottom: '20px'}}>{year}년 {month}월 수익 입력</p>
            <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>월 이자</div>
                <input type="number" placeholder="0" value={returnForm.monthly_interest} onChange={e => setReturnForm(p => ({...p, monthly_interest: e.target.value}))} style={{width: '100%', textAlign: 'right'}} />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>캐시백 리워드</div>
                <input type="number" placeholder="0" value={returnForm.cashback} onChange={e => setReturnForm(p => ({...p, cashback: e.target.value}))} style={{width: '100%', textAlign: 'right'}} />
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>만기 리워드</div>
                <input type="number" placeholder="0" value={returnForm.maturity_reward} onChange={e => setReturnForm(p => ({...p, maturity_reward: e.target.value}))} style={{width: '100%', textAlign: 'right'}} />
              </div>
              <div style={{background: '#f9fafb', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between'}}>
                <span style={{fontSize: '14px', color: '#8b95a1'}}>총 수익</span>
                <span style={{fontSize: '15px', fontWeight: '700', color: '#00b493'}}>
                  {((parseInt(returnForm.monthly_interest) || 0) + (parseInt(returnForm.cashback) || 0) + (parseInt(returnForm.maturity_reward) || 0)).toLocaleString()}원
                </span>
              </div>
              <div>
                <div style={{fontSize: '12px', color: '#8b95a1', marginBottom: '4px'}}>메모</div>
                <input type="text" placeholder="메모 (선택)" value={returnForm.memo} onChange={e => setReturnForm(p => ({...p, memo: e.target.value}))} style={{width: '100%'}} />
              </div>
            </div>
            <div style={{display: 'flex', gap: '8px', marginTop: '20px'}}>
              <button onClick={() => setShowReturnForm(false)} className="btn btn-secondary" style={{flex: 1}}>취소</button>
              <button onClick={handleSaveReturn} disabled={saving} className="btn btn-primary" style={{flex: 1}}>{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Investments