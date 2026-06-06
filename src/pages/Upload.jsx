import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

function Upload() {
  const [transactions, setTransactions] = useState([])
  const [fileName, setFileName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setSaved(false)

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

    const rows = transactions.map(t => {
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
    setSaving(false)
  }

  return (
    <div>
      <h2 style={{marginBottom: '24px'}}>카드내역 업로드</h2>

      <div className="card" style={{marginBottom: '16px'}}>
        <div style={{
          border: '2px dashed #e8ebed',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          background: '#f9fafb',
          cursor: 'pointer',
        }}>
          <div style={{fontSize: '32px', marginBottom: '12px'}}>📂</div>
          <p style={{color: '#8b95a1', fontSize: '14px', marginBottom: '16px'}}>
            신한, 삼성 카드 엑셀 파일을 업로드해주세요
          </p>
          <label style={{
            display: 'inline-block',
            padding: '10px 20px',
            background: '#3182f6',
            color: 'white',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}>
            파일 선택
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display: 'none'}} />
          </label>
          {fileName && (
            <p style={{marginTop: '12px', fontSize: '13px', color: '#3182f6', fontWeight: '500'}}>{fileName}</p>
          )}
        </div>
      </div>

      {saved && (
        <div style={{
          background: '#e5faf6',
          border: '1px solid #00b493',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#00b493',
          fontSize: '14px',
          fontWeight: '500',
        }}>
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
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : 'Supabase에 저장'}
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
    </div>
  )
}

export default Upload