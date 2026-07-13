import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { redeemMagicLink } from '@/lib/magic'

export default function MagicRedeem() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const token = params.get('t') ?? ''
    if (!token || !auth) {
      setError('Μη έγκυρος σύνδεσμος.')
      return
    }
    ;(async () => {
      try {
        const { token: customToken } = await redeemMagicLink(token)
        await signInWithCustomToken(auth, customToken)
        navigate('/', { replace: true })
      } catch (e) {
        setError((e as Error).message || 'Η είσοδος απέτυχε.')
      }
    })()
  }, [params, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-blue-50 to-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        {error ? (
          <>
            <h1 className="mb-2 text-lg font-semibold text-gray-900">Η είσοδος απέτυχε</h1>
            <p className="mb-4 text-sm text-gray-600">{error}</p>
            <Link to="/login" className="text-sm font-medium text-blue-600 hover:underline">
              Επιστροφή στην είσοδο
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />
            <p className="text-sm text-gray-600">Γίνεται είσοδος…</p>
          </>
        )}
      </div>
    </div>
  )
}
