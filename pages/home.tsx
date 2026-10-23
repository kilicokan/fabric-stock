'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import HomePage from '../components/HomePage'
import { useAuth } from '../components/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function Home() {
  const router = useRouter()
  const { user, loading, authenticated, error } = useAuth()

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace('/login')
    }
  }, [authenticated, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900">
        <div className="w-full max-w-md px-4">
          <Skeleton count={3} />
        </div>
      </div>
    )
  }

  if (!authenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900 p-4">
        <div className="w-full max-w-md">
          <Alert variant="warning" title="Oturum Gerekli">
            {error || 'Oturumunuz gecersiz veya suresi dolmus. Lutfen tekrar giris yapiniz.'}
          </Alert>
          <Button
            onClick={() => router.replace('/login')}
            variant="default"
            size="lg"
            className="w-full mt-4"
          >
            Giris Sayfasina Git
          </Button>
        </div>
      </div>
    )
  }

  return <HomePage user={user} />
}
