import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

function Upload() {
  const [step, setStep] = useState('upload') // 'upload' | 'categorize'
  const [transactions, setTransactions] = useState([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(null)
  const [categories, setCategories] = useState([])
  const [categorizing, setCategorizing] = useState(false)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setDuplicateModal(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      let all = []
      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        if (rows[0] && rows[0].includes('거래일')) all = [...all, ...parseShinhan(rows)]
        if (rows[0] && rows[0].includes('승인일자')) all = [...all, ...parseSamsung(rows)]
      })
      setTransactions(all)
    }
    reader.readAsBinaryString(file)
  }

  function parseShinhan(rows) {
    const header = rows[0]
    const dateIdx = header.indexOf('거래일')
    const merchantIdx = header.indexOf('가맹점명')
    const amountIdx = header.indexOf('금액')
    const cancelIdx = header.indexOf('취소상태')
    const statusIdx = header.indexOf('매입구분')
    return rows.slice(1)
      .filter(row => row && row[merchantIdx])
      .filter(row => row[cancelIdx] !== '취소' && row[cancelIdx] !== '거래취소')
      .filter(row => row[statusIdx] === '결제확정')
      .map(row => ({
        date: row[dateIdx]?.toString().substring(0, 10).replace(/\./g, '-'),
        merchant: row[merchantIdx],
        amount: parseInt(row[amountIdx]?.toString().replace(/,/g, '') || 0),
        card_type: '신한',
      }))
      .filter(t => t.amount > 0)
  }

  function parseSamsung(rows) {
    const header = rows[0]
    const dateIdx = header.indexOf('승인일자')
    const merchantIdx = header.indexOf('가맹점명')
    const amountIdx = header.indexOf('승인금액(원)')
    const cancelIdx = header.indexOf('취소여부')
    return rows.slice(1)
      .filter(row => row && row[merchantIdx])
      .filter(row => row[cancelIdx] !== 'Y')
      .map(row => ({
        date: row[dateIdx]?.toString().replace(/\./g, '-'),
        merchant: row[merchantIdx],
        amount: parseInt(row[amountIdx] || 0),
        card_type: '삼성',
      }))
      .filter(t => t.amount > 0)
  }

  async function handleSave() {
    if (transactions.length === 0) return
    setSaving(true)
    setChecking(true)

    const { data: existing } = await supabase
      .from('transactions')
      .select('date, merchant, amount')
      .in('date', [...new Set(transactions.map(t => t.date))])

    const existingKeys = new Set((existing || []).map(t => `${t.date}_${t.merchant}_${t.amount}`))
    const dupes = transactions.filter(t => existingKeys.has(`${t.date}_${t.merchant}_${t.amount}`)).map(t => ({ ...t, keep: false }))
    const nonDupes = transactions.filter(t => !existingKeys.has(`${t.date}_${t.merchant}_${t.amount}`))

    setChecking(false)
    setSaving(false)

    if (dupes.length > 0) {
      setDuplicateModal({ dupes, nonDupes })
    } else {
      await saveAndProceed(transactions)
    }
  }

  function toggleKeep(idx) {
    setDuplicateModal(prev => ({ ...prev, dupes: prev.dupes.map((d, i) => i === idx ? { ...d, keep: !d.keep } : d) }))
  }

  function toggleAll(keep) {
    setDuplicateModal(prev => ({ ...prev, dupes: prev.dupes.map(d => ({ ...d, keep })) }))
  }

  async function handleModalSave() {
    setSaving(true)
    const kept = duplicateModal.dupes.filter(d => d.keep)
    const toSave = [...duplicateModal.nonDupes, ...kept]
    if (toSave.length === 0) { alert('저장할 내역이 없어요.'); setSaving(false); setDuplicateModal(null); return }
    await saveAndProceed(toSave)
    setDuplicateModal(null)
    setSaving(false)
  }

  async function saveAndProceed(list) {
    setSaving(true)
    const rows = list.map(t => {
      const [year, month] = t.date.split('-')
      return { year: parseInt(year), month: parseInt(month), date: t.date, merchant: t.merchant, amount: t.amount, card_type: t.card_type }
    })

    const { data: inserted, error } = await supabase.from('transactions').insert(rows).select()
    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }

    // 카테고리 불러오고 분류 단계로
    const { data: cats } = await supabase.from('categories').select('*').eq('type', 'expense').order('sort_order')
    const { data: rules } = await supabase.from('merchant_rules').select('*, categories(*)')

    const catList = cats || []
    const ruleList = rules || []

    // 자동 매핑
    let autoCount = 0
    const withCategory = (inserted || []).map(t => {
      const rule = ruleList.find(r => r.merchant_name === t.merchant)
      if (rule) { autoCount++; return { ...t, selectedCategory: rule.category_id, autoMapped: true } }
      return { ...t, selectedCategory: '', autoMapped: false }
    })

    setTransactions(withCategory)
    setCategories(catList)
    setSaving(false)
    setStep('categorize')
    if (autoCount > 0) setTimeout(() => {}, 0) // trigger re-render
  }

  function handleCategoryChange(id, categoryId) {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, selectedCategory: categoryId, autoMapped: false } : t))
  }

  async function handleCategorySave() {
    setCategorizing(true)
    const toUpdate = transactions.filter(t => t.selectedCategory)

    for (const t of toUpdate) {
      await supabase.from('transactions').update({ category_id: t.selectedCategory }).eq('id', t.id)
      if (!t.autoMapped) {
        await supabase.from('merchant_rules').upsert({ merchant_name: t.merchant, category_id: t.selectedCategory }, { onConflict: 'merchant_name' })
      }
    }

    setCategorizing(false)
    setStep('done')
  }

  const mainCategories = [...new Set(categories.map(c => c.main_category))]
  function getSubCategories(main) { return categories.filter(c => c.main_category === main) }
  const autoMappedCount = transactions.filter(t => t.autoMapped).length
  const categorizedCount = transactions.filter(t => t.selectedCategory).length
  const uncategorizedCount = transactions.filter(t => !t.selectedCategory).length

  // 완료 화면
  if (step === 'done') {
    return (
      <div>
        <h2 style={{marginBottom: '24px'}}>카드내역 업로드</h2>
        <div className="card" style={{textAlign: 'center', padding: '60px 40px'}}>
          <div style={{fontSize: '48px', marginBottom: '16px'}}>🎉</div>
          <h3 style={{marginBottom: '8px', color: '#191f28'}}>업로드 완료!</h3>
          <p style={{fontSize: '14px', color: '#8b95a1', marginBottom: '24px'}}>
            {transactions.length}건의 거래가 저장됐어요.
          </p>
          <button
            onClick={() => { setStep('upload'); setTransactions([]); setFileName('') }}
            className="btn btn-primary"
          >
            새 파일 업로드
          </button>
        </div>
      </div>
    )
  }

  // 카테고리 분류 화면
  if (step === 'categorize') {
    return (
      <div>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
          <h2>카테고리 분류</h2>
          <span style={{fontSize: '13px', color: '#8b95a1', background: '#f2f4f6', padding: '4px 10px', borderRadius: '20px'}}>
            2단계 / 2
          </span>
        </div>

        {autoMappedCount > 0 && (
          <div style={{background: '#e5faf6', border: '1px solid #00b493', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#00b493', fontWeight: '500'}}>
            ✓ {autoMappedCount}건이 저장된 룰로 자동 분류됐어요!
          </div>
        )}

        {uncategorizedCount > 0 && (
          <div style={{background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#ff8c00', fontWeight: '500'}}>
            ⚠ {uncategorizedCount}건은 직접 분류해주세요.
          </div>
        )}

        <div className="card" style={{marginBottom: '16px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <div>
              <span style={{fontWeight: '600'}}>{transactions.length}건</span>
              <span style={{fontSize: '13px', color: '#8b95a1', marginLeft: '6px'}}>중 {categorizedCount}건 분류됨</span>
            </div>
            <div style={{display: 'flex', gap: '8px'}}>
              <button
                onClick={() => { setStep('upload'); setTransactions([]); setFileName('') }}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleCategorySave}
                disabled={categorizing}
                className="btn btn-primary"
              >
                {categorizing ? '저장 중...' : `${categorizedCount}건 저장`}
              </button>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>가맹점</th>
                <th style={{textAlign: 'right'}}>금액</th>
                <th>대분류</th>
                <th>소분류</th>
                <th style={{textAlign: 'center'}}>자동</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => {
                const selectedMain = categories.find(c => c.id === t.selectedCategory)?.main_category || ''
                return (
                  <tr key={t.id} style={{background: t.autoMapped ? '#f6fffe' : 'transparent'}}>
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
                        {mainCategories.map(m => <option key={m} value={m}>{m}</option>)}
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
                        {getSubCategories(selectedMain).map(c => <option key={c.id} value={c.id}>{c.sub_category}</option>)}
                      </select>
                    </td>
                    <td style={{textAlign: 'center'}}>
                      {t.autoMapped
                        ? <span className="badge badge-success">자동</span>
                        : <span style={{color: '#b0b8c1', fontSize: '12px'}}>-</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // 업로드 화면
  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
        <h2>카드내역 업로드</h2>
        <span style={{fontSize: '13px', color: '#8b95a1', background: '#f2f4f6', padding: '4px 10px', borderRadius: '20px'}}>
          1단계 / 2
        </span>
      </div>

      <div className="card" style={{marginBottom: '16px'}}>
        <div style={{border: '2px dashed #e8ebed', borderRadius: '12px', padding: '40px', textAlign: 'center', background: '#f9fafb'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>📂</div>
          <p style={{color: '#8b95a1', fontSize: '14px', marginBottom: '16px'}}>신한, 삼성 카드 엑셀 파일을 업로드해주세요</p>
          <label style={{display: 'inline-block', padding: '10px 20px', background: '#3182f6', color: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'}}>
            파일 선택
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display: 'none'}} />
          </label>
          {fileName && <p style={{marginTop: '12px', fontSize: '13px', color: '#3182f6', fontWeight: '500'}}>{fileName}</p>}
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <div>
              <span style={{fontWeight: '600', fontSize: '15px'}}>{transactions.length}건</span>
              <span style={{color: '#8b95a1', fontSize: '14px', marginLeft: '6px'}}>파싱됨</span>
            </div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || checking}>
              {checking ? '중복 확인 중...' : saving ? '저장 중...' : '저장 후 분류하기 →'}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>가맹점</th>
                <th style={{textAlign: 'right'}}>금액</th>
                <th style={{textAlign: 'center'}}>카드</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, i) => (
                <tr key={i}>
                  <td style={{color: '#8b95a1'}}>{t.date}</td>
                  <td style={{fontWeight: '500'}}>{t.merchant}</td>
                  <td style={{textAlign: 'right', fontWeight: '600'}}>{t.amount.toLocaleString()}원</td>
                  <td style={{textAlign: 'center'}}><span className="badge badge-primary">{t.card_type}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 중복 모달 */}
      {duplicateModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div style={{background: 'white', borderRadius: '16px', padding: '28px', width: '560px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{marginBottom: '20px'}}>
              <h3 style={{marginBottom: '6px'}}>중복 내역 발견</h3>
              <p style={{fontSize: '14px', color: '#8b95a1'}}>{duplicateModal.dupes.length}건이 이미 저장된 내역과 중복돼요. Keep할 항목을 선택해주세요.</p>
            </div>
            <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
              <button onClick={() => toggleAll(true)} style={{padding: '4px 12px', borderRadius: '6px', border: '1px solid #3182f6', background: 'white', color: '#3182f6', fontSize: '12px', cursor: 'pointer', fontWeight: '600'}}>전체 Keep</button>
              <button onClick={() => toggleAll(false)} style={{padding: '4px 12px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', color: '#8b95a1', fontSize: '12px', cursor: 'pointer', fontWeight: '600'}}>전체 제외</button>
            </div>
            <div style={{overflowY: 'auto', flex: 1, marginBottom: '20px'}}>
              <table>
                <thead>
                  <tr>
                    <th style={{textAlign: 'center'}}>Keep</th>
                    <th>날짜</th>
                    <th>가맹점</th>
                    <th style={{textAlign: 'right'}}>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateModal.dupes.map((d, i) => (
                    <tr key={i} style={{background: d.keep ? '#f0f7ff' : 'transparent'}}>
                      <td style={{textAlign: 'center'}}><input type="checkbox" checked={d.keep} onChange={() => toggleKeep(i)} style={{cursor: 'pointer', width: '16px', height: '16px'}} /></td>
                      <td style={{color: '#8b95a1'}}>{d.date}</td>
                      <td style={{fontWeight: '500'}}>{d.merchant}</td>
                      <td style={{textAlign: 'right', fontWeight: '600'}}>{d.amount.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <p style={{fontSize: '13px', color: '#8b95a1'}}>중복 제외 {duplicateModal.nonDupes.length}건 + Keep {duplicateModal.dupes.filter(d => d.keep).length}건 저장 예정</p>
              <div style={{display: 'flex', gap: '8px'}}>
                <button onClick={() => setDuplicateModal(null)} style={{padding: '8px 18px', borderRadius: '8px', border: '1px solid #e8ebed', background: 'white', fontSize: '14px', cursor: 'pointer'}}>취소</button>
                <button onClick={handleModalSave} disabled={saving} className="btn btn-primary">{saving ? '저장 중...' : '저장하기'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Upload