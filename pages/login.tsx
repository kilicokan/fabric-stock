'use client'

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/router"
import axios from "axios"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { Mail, Lock } from "lucide-react"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem("token")
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const response = await axios.post("/api/auth/login", { email, password })
      localStorage.setItem("token", response.data.token)
      const license = response.data?.license
      const isBlocked =
        license &&
        license.ok === false &&
        license.mode === "enforce"
      const targetRoute = isBlocked ? "/license" : "/home"
      sessionStorage.setItem("auth:splash-event", "login")
      router.push(targetRoute)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        const message = err.response?.data?.message
        setError(
          typeof message === "string"
            ? message
            : status
              ? "Giriş isteği tamamlanamadı. Lütfen tekrar deneyin."
              : "Sunucuya ulaşılamadı. İnternet bağlantınızı ve sunucu durumunu kontrol edin."
        )
      } else {
        setError("Giriş sırasında beklenmeyen bir hata oluştu.")
      }
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary-50 to-secondary-100 dark:from-secondary-900 dark:to-secondary-800 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-secondary-900 rounded-xl shadow-xl p-8 border border-secondary-200 dark:border-secondary-700">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <Image
                src="/miraapp-logo.jpg"
                alt="MiraApp Logo"
                width={160}
                height={160}
                className="h-40 w-40 object-contain"
                priority
                unoptimized
              />
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-secondary-900 dark:text-secondary-50 mb-2">
                Giriş Yap
              </h1>
              <p className="text-secondary-600 dark:text-secondary-400">
                Miraapp Yönetim Sistemine Hoş Geldiniz
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert 
                variant="error" 
                title="Giriş Hatası"
                onClose={() => setError("")}
                className="mb-6"
              >
                {error}
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  E-posta Adresi
                  <span className="text-error-500 ml-1" aria-label="gerekli">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-5 w-5 text-secondary-400 dark:text-secondary-500 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@mira.com"
                    required
                    disabled={isLoading}
                    autoComplete="email"
                    aria-label="E-posta adresi"
                    className="w-full pl-10 pr-4 py-2.5 border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-secondary-500 dark:placeholder:text-secondary-400"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300 mb-2">
                  Şifre
                  <span className="text-error-500 ml-1" aria-label="gerekli">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-secondary-400 dark:text-secondary-500 pointer-events-none" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-label="Şifre"
                    className="w-full pl-10 pr-4 py-2.5 border border-secondary-300 dark:border-secondary-600 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-50 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors placeholder:text-secondary-500 dark:placeholder:text-secondary-400"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full mt-8"
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? "Giriş Yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-8 border-t border-secondary-200 dark:border-secondary-700 text-center">
              <p className="text-xs text-secondary-600 dark:text-secondary-400">
                Miraapp © 2025 Tüm Hakları Saklıdır.
              </p>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center text-sm text-secondary-600 dark:text-secondary-400">
            <p>
              Test Hesabı: <code className="bg-secondary-100 dark:bg-secondary-800 px-2 py-1 rounded font-mono text-xs">admin@mira.com</code>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
