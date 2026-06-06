import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

function Upload() {
  const [transactions, setTransactions] = useState([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [duplicateModal, setDuplicateModal] = useState(null) // { dupes, nonDupes }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setSaved(false)
    setDuplicateModal(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      let allTransactions = []
      wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        if (rows[0] && rows[0].includes('거래일')) {
          allTransactions = [...allTransactions, ...parseShinhan(rows)]
        }
        if (rows[0] && rows[0].includes('승인일자')) {
          allTransactions = [...allTransactions, ...parseSamsung(rows)]
        }
      })
      setTransactions(allTransactions)
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

    const existingKeys = new Set(
      (existing || []).map(t => `${t.date}_${t.merchant}_${t.amount}`)
    )

    const dupes = transactions
      .filter(t => existingKeys.has(`${t.date}_${t.merchant}_${t.amount}`))
      .map(t => ({ ...t, keep: false }))
    const nonDupes = transactions.filter(t => !existingKeys.has(`${t.date}_${t.merchant}_${t.amount}`))

    setChecking(false)
    setSaving(false)

    if (dupes.length > 0) {
      setDuplicateModal({ dupes, nonDupes })
    } else {
      await saveTransactions(transactions)
    }
  }

  function toggleKeep(idx) {
    setDuplicateModal(prev => ({
      ...prev,
      dupes: prev.dupes.map((d, i) => i === idx ? { ...d, keep: !d.keep } : d)
    }))
  }

  function toggleAll(keep) {
    setDuplicateModal(prev => ({
      ...prev,
      dupes: prev.dupes.map(d => ({ ...d, keep }))
    }))
  }

  async function handleModalSave() {
    setSaving(true)
    const keptDupes = duplicateModal.dupes.filter(d => d.keep)
    const toSave = [...duplicateModal.nonDupes, ...keptDupes]

    if (toSave.length === 0) {
      alert('저장할 내역이 없어요.')
      setSaving(false)
      setDuplicateModal(null)
      return
    }

    await saveTransactions(toSave)
    setDuplicateModal(null)
    setSaving(false)
  }

  async function saveTransactions(list) {
    const rows = list.map(t => {
      const [year, month] = t.date.split('-')
      return {
        year: parseInt(year),
        month: parseInt(month),
        date: t.date,
        merchant: t.merchant,
        amount: t.amount,
        card_type: t.card_type,
      }
    })

    const { error } = await supabase.from('transactions').insert(rows)
    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      setSaved(true)
      setTransactions([])
      setFileName('')
    }
  }

  return (
    <div>
      <h2 style={{marginBottom: '24px'}}>카드내역 업로드</h2>

      <div className="card" style={{marginBottom: '16px'}}>
        <div style={{border: '2px dashed #e8ebed', borderRadius: '12px', padding: '40px', textAlign: 'center', background: '#f9fafb'}}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>📂</div>
          <p style={{color: '#8b95a1', fontSize: '14px', marginBottom: '16px'}}>
            신한, 삼성 카드 엑셀 파일을 업로드해주세요
          </p>
          <label style={{display: 'inline-block', padding: '10px 20px', background: '#3182f6', color: 'white', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'}}>
            파일 선택
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display: 'none'}} />
          </label>
          {fileName && (
            <p style={{marginTop: '12px', fontSize: '13px', color: '#3182f6', fontWeight: '500'}}>{fileName}</p>
          )}
        </div>
      </div>

      {saved && (
        <div style={{background: '#e5faf6', border: '1px solid #00b493', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#00b493', fontSize: '14px', fontWeight: '500'}}>
          ✓ 저장 완료!
        </div>
      )}

      {transactions.length > 0 && (
        <div className="card">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <div>
              <span style={{fontWeight: '600', fontSize: '15px'}}>{transactions.length}건</span>
              <span style={{color: '#8b95a1', fontSize: '14px', marginLeft: '6px'}}>파싱됨</span>
            </div>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || checking}>
              {checking ? '중복 확인 중...' : saving ? '저장 중...' : 'Supabase에 저장'}
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
                  <td style={{textAlign: 'center'}}>
                    <span className="badge badge-primary">{t.card_type}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 중복 내역 모달 */}
      {duplicateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '28px',
            width: '560px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{marginBottom: '20px'}}>
              <h3 style={{marginBottom: '6px'}}>중복 내역 발견</h3>
              <p style={{fontSize: '14px', color: '#8b95a1'}}>
                아래 {duplicateModal.dupes.length}건이 이미 저장된 내역과 중복돼요. Keep할 항목을 선택해주세요.
              </p>
            </div>

            <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
              <button
                onClick={() => toggleAll(true)}
                style={{padding: '4px 12px', borderRadius: '6px', border: '1px solid #3182f6', background: 'white', color: '#3182f6', fontSize: '12px', cursor: 'pointer', fontWeight: '600'}}
              >
                전체 Keep
              </button>
              <button
                onClick={() => toggleAll(false)}
                style={{padding: '4px 12px', borderRadius: '6px', border: '1px solid #e8ebed', background: 'white', color: '#8b95a1', fontSize: '12px', cursor: 'pointer', fontWeight: '600'}}
              >
                전체 제외
              </button>
            </div>

            <div style={{overflowY: 'auto', flex: 1, marginBottom: '20px'}}>
              <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
                <thead>
                  <tr>
                    <th style={{padding: '8px', textAlign: 'center', borderBottom: '1px solid #e8ebed', color: '#8b95a1', fontWeight: '500'}}>Keep</th>
                    <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e8ebed', color: '#8b95a1', fontWeight: '500'}}>날짜</th>
                    <th style={{padding: '8px', textAlign: 'left', borderBottom: '1px solid #e8ebed', color: '#8b95a1', fontWeight: '500'}}>가맹점</th>
                    <th style={{padding: '8px', textAlign: 'right', borderBottom: '1px solid #e8ebed', color: '#8b95a1', fontWeight: '500'}}>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateModal.dupes.map((d, i) => (
                    <tr key={i} style={{background: d.keep ? '#f0f7ff' : 'transparent'}}>
                      <td style={{padding: '8px', textAlign: 'center', borderBottom: '1px solid #f0f0f0'}}>
                        <input
                          type="checkbox"
                          checked={d.keep}
                          onChange={() => toggleKeep(i)}
                          style={{cursor: 'pointer', width: '16px', height: '16px'}}
                        />
                      </td>
                      <td style={{padding: '8px', borderBottom: '1px solid #f0f0f0', color: '#8b95a1'}}>{d.date}</td>
                      <td style={{padding: '8px', borderBottom: '1px solid #f0f0f0', fontWeight: '500'}}>{d.merchant}</td>
                      <td style={{padding: '8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right', fontWeight: '600'}}>{d.amount.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <p style={{fontSize: '13px', color: '#8b95a1'}}>
                중복 제외 {duplicateModal.nonDupes.length}건 + Keep {duplicateModal.dupes.filter(d => d.keep).length}건 저장 예정
              </p>
              <div style={{display: 'flex', gap: '8px'}}>
                <button
                  onClick={() => setDuplicateModal(null)}
                  style={{padding: '8px 18px', borderRadius: '8px', border: '1px solid #e8ebed', background: 'white', fontSize: '14px', cursor: 'pointer'}}
                >
                  취소
                </button>
                <button
                  onClick={handleModalSave}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? '저장 중...' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Upload