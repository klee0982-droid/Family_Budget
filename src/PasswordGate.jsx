import { useState } from 'react'

const PASSWORD = import.meta.env.VITE_APP_PASSWORD

function PasswordGate({ children }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)
  const [unlocked, setUnlocked] = useState(
    sessionStorage.getItem('unlocked') === 'true'
  )

  function handleSubmit(e) {
    e.preventDefault()
    if (input === PASSWORD) {
      sessionStorage.setItem('unlocked', 'true')
      setUnlocked(true)
    } else {
      setError(true)
      setInput('')
    }
  }

  if (unlocked) return children

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f2f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div className="card" style={{width: '360px', textAlign: 'center', padding: '40px'}}>
        <div style={{
          width: '48px', height: '48px',
          background: '#3182f6',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <span style={{color: 'white', fontSize: '20px', fontWeight: '700'}}>가</span>
        </div>
        <h2 style={{marginBottom: '8px'}}>가계부</h2>
        <p style={{fontSize: '14px', color: '#8b95a1', marginBottom: '28px'}}>비밀번호를 입력해주세요</p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            placeholder="비밀번호"
            style={{
              width: '100%',
              marginBottom: '12px',
              border: error ? '1.5px solid #f04452' : undefined,
            }}
            autoFocus
          />
          {error && (
            <p style={{fontSize: '13px', color: '#f04452', marginBottom: '12px'}}>
              비밀번호가 틀렸어요
            </p>
          )}
          <button type="submit" className="btn btn-primary" style={{width: '100%'}}>
            입력
          </button>
        </form>
      </div>
    </div>
  )
}

export default PasswordGate