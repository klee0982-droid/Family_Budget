import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#3182f6', '#00b493', '#f04452', '#ff8c00', '#7c3aed', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#eab308']

function MonthlyReport() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchData() }, [year, month])

  async function fetchData() {
    setLoading(true)
    const [{ data }, { data: catData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, categories(main_category, sub_category)')
        .eq('year', year)
        .eq('month', month)
        .order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('type', 'expense').order('sort_order')
    ])

    const txList = data || []
    setTransactions(txList)
    setCategories(catData || [])

    const categoryMap = {}
    txList.filter(t => t.category_id).forEach(t => {
      const name = t.categories?.main_category || '미분류'
      categoryMap[name] = (categoryMap[name] || 0) + t.amount
    })
    setChartData(
      Object.entries(categoryMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
    )
    setLoading(false)
  }

  function startEdit(t) {
    setEditingId(t.id)
    setEditForm({
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      category_id: t.category_id || '',
      card_type: t.card_type || '',
    })
  }

  async function handleSaveEdit(id) {
    setSaving(true)
    const [yr, mo] = editForm.date.split('-')
    await supabase.from('transactions').update({
      date: editForm.date,
      merchant: editForm.merchant,
      amount: parseInt(editForm.amount),
      category_id: editForm.category_id || null,
      card_type: editForm.card_type,
      year: parseInt(yr),
      month: parseInt(mo),
    }).eq('id', id)
    setEditingId(null)
    await fetchData()
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!window.confirm('이 거래 내역을 삭제할까요?')) return
    await supabase.from('transactions').delete().eq('id', id)
    await fetchData()
  }

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  function getSubCategories(main) {
    return categories.filter(c => c.main_category === main)
  }

  const totalExpense = transactions.reduce((s, t) => s + t.amount, 0)
  const uncategorized = transactions.filter(t => !t.category_id)
  const selectedMain = categories.find(c => c.id === editForm.category_id)?.main_category || ''

  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px'}}>
        <h2>월별 리포트</h2>
        <div style={{display: 'flex', gap: '8px'}}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{color: '#8b95a1', padding: '40px 0', textAlign: 'center'}}>불러오는 중...</div>
      ) : (
        <>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px'}}>
            <div className="stat-card">
              <div className="label">총 지출</div>
              <div className="value" style={{color: '#f04452'}}>{totalExpense.toLocaleString()}원</div>
            </div>
            <div className="stat-card">
              <div className="label">분류 완료</div>
              <div className="value" style={{color: '#00b493'}}>{transactions.length - uncategorized.length}건</div>
            </div>
            <div className="stat-card">
              <div className="label">미분류</div>
              <div className="value" style={{color: uncategorized.length > 0 ? '#ff8c00' : '#00b493'}}>
                {uncategorized.length}건
              </div>
            </div>
          </div>

          {uncategorized.length > 0 && (
            <div style={{background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px', color: '#ff8c00', fontWeight: '500'}}>
              ⚠ 미분류 거래 {uncategorized.length}건이 있어요. 카테고리 분류 페이지에서 분류해주세요.
            </div>
          )}

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px'}}>
            <div className="card">
              <h3 style={{marginBottom: '20px'}}>카테고리별 지출</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} layout="vertical" margin={{left: 8}}>
                    <XAxis type="number" tickFormatter={v => (v / 10000).toFixed(0) + '만'} tick={{fontSize: 12}} />
                    <YAxis type="category" dataKey="name" width={65} tick={{fontSize: 12}} />
                    <Tooltip formatter={v => v.toLocaleString() + '원'} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0', fontSize: '14px'}}>데이터가 없어요</div>
              )}
            </div>

            <div className="card">
              <h3 style={{marginBottom: '20px'}}>지출 비중</h3>
              {chartData.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                  {chartData.map((item, i) => (
                    <div key={item.name}>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '4px'}}>
                        <span style={{fontSize: '13px', color: '#191f28'}}>{item.name}</span>
                        <span style={{fontSize: '13px', fontWeight: '600'}}>{item.value.toLocaleString()}원</span>
                      </div>
                      <div style={{height: '6px', background: '#f2f4f6', borderRadius: '99px'}}>
                        <div style={{height: '100%', width: `${totalExpense > 0 ? (item.value / totalExpense * 100) : 0}%`, background: COLORS[i % COLORS.length], borderRadius: '99px'}} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{color: '#8b95a1', textAlign: 'center', padding: '40px 0', fontSize: '14px'}}>데이터가 없어요</div>
              )}
            </div>
          </div>

          <div className="card">
            <h3 style={{marginBottom: '16px'}}>전체 거래 내역</h3>
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>가맹점</th>
                  <th>카테고리</th>
                  <th style={{textAlign: 'right'}}>금액</th>
                  <th style={{textAlign: 'center'}}>카드</th>
                  <th style={{textAlign: 'center'}}>관리</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  editingId === t.id ? (
                    <tr key={t.id} style={{background: '#f6f8ff'}}>
                      <td>
                        <input
                          type="date"
                          value={editForm.date}
                          onChange={e => setEditForm(p => ({...p, date: e.target.value}))}
                          style={{width: '130px', fontSize: '13px'}}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.merchant}
                          onChange={e => setEditForm(p => ({...p, merchant: e.target.value}))}
                          style={{width: '140px', fontSize: '13px'}}
                        />
                      </td>
                      <td style={{display: 'flex', gap: '4px'}}>
                        <select
                          value={selectedMain}
                          onChange={e => {
                            const firstSub = getSubCategories(e.target.value)[0]
                            setEditForm(p => ({...p, category_id: firstSub?.id || ''}))
                          }}
                          style={{fontSize: '12px', width: '80px'}}
                        >
                          <option value="">선택</option>
                          {mainCategories.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={editForm.category_id}
                          onChange={e => setEditForm(p => ({...p, category_id: e.target.value}))}
                          style={{fontSize: '12px', width: '80px'}}
                          disabled={!selectedMain}
                        >
                          <option value="">선택</option>
                          {getSubCategories(selectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                        </select>
                      </td>
                      <td style={{textAlign: 'right'}}>
                        <input
                          type="number"
                          value={editForm.amount}
                          onChange={e => setEditForm(p => ({...p, amount: e.target.value}))}
                          style={{width: '100px', textAlign: 'right', fontSize: '13px'}}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.card_type}
                          onChange={e => setEditForm(p => ({...p, card_type: e.target.value}))}
                          style={{width: '60px', fontSize: '13px', textAlign: 'center'}}
                        />
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                          <button
                            onClick={() => handleSaveEdit(t.id)}
                            disabled={saving}
                            style={{padding: '4px 10px', borderRadius: '6px', border: 'none', background: '#3182f6', color: 'white', fontSize: '12px', cursor: 'pointer'}}
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', fontSize: '12px', cursor: 'pointer'}}
                          >
                            취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id}>
                      <td style={{color: '#8b95a1', fontSize: '13px'}}>{t.date}</td>
                      <td style={{fontWeight: '500'}}>{t.merchant}</td>
                      <td>
                        {t.categories
                          ? <span className="tag">{t.categories.main_category} · {t.categories.sub_category}</span>
                          : <span style={{color: '#ff8c00', fontSize: '12px', fontWeight: '500'}}>미분류</span>
                        }
                      </td>
                      <td style={{textAlign: 'right', fontWeight: '600'}}>{t.amount.toLocaleString()}원</td>
                      <td style={{textAlign: 'center'}}>
                        <span className="badge badge-primary">{t.card_type}</span>
                      </td>
                      <td style={{textAlign: 'center'}}>
                        <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                          <button
                            onClick={() => startEdit(t)}
                            style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#3182f6'}}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            style={{padding: '4px 10px', borderRadius: '6px', border: '1px solid #f04452', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#f04452'}}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default MonthlyReport