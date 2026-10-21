import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loginAdmin } from '../services/api.js'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const from = location.state?.from?.pathname || '/dashboard'

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')

    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    try {
      setLoading(true)

      await loginAdmin(
        email.trim(),
        password
      )

      navigate(from, {
        replace: true,
      })
    } catch (error) {
      console.error('Admin login failed:', error)

      setError(
        error?.message ||
        'Invalid email or password.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080d1c',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: '28px',
          }}
        >
          <h1
            style={{
              color: '#ffffff',
              fontSize: '28px',
              marginBottom: '8px',
            }}
          >
            CATI QA
          </h1>

          <p
            style={{
              color: '#9ca3af',
              margin: 0,
            }}
          >
            Admin Login
          </p>
        </div>

        {error && (
          <div
            style={{
              background: '#3f1515',
              border: '1px solid #7f1d1d',
              color: '#fca5a5',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '18px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                color: '#d1d5db',
                marginBottom: '8px',
                fontSize: '14px',
              }}
            >
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="admin@example.com"
              autoComplete="username"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #374151',
                background: '#0f172a',
                color: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label
              style={{
                display: 'block',
                color: '#d1d5db',
                marginBottom: '8px',
                fontSize: '14px',
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Enter password"
              autoComplete="current-password"
              disabled={loading}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #374151',
                background: '#0f172a',
                color: '#ffffff',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              border: 'none',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}