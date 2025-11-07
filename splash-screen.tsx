"use client"

import { useEffect, useState } from "react"

interface SplashScreenProps {
  autoHide?: boolean;
  onHide?: () => void;
}

export default function SplashScreen({ autoHide = true, onHide }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onHide?.()
      }, 3500)

      return () => clearTimeout(timer)
    }
  }, [autoHide, onHide])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white overflow-hidden">
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
            linear-gradient(to right, #333 1px, transparent 1px),
            linear-gradient(to bottom, #333 1px, transparent 1px)
          `,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Ana içerik */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo container */}
        <div className="relative">
          {/* Dış halka animasyonu */}
          <div className="absolute inset-0 -m-8">
            <div className="w-full h-full border-2 border-white/20 rounded-full animate-ping" />
          </div>
          <div className="absolute inset-0 -m-6">
            <div
              className="w-full h-full border-2 border-white/30 rounded-full animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
          </div>

          {/* Logo */}
          <div className="relative bg-white rounded-3xl p-8 shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3">
              {/* İkon - Üretim takip simgesi */}
              <div className="relative">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="animate-fade-in"
                >
                  {/* Fabrika/üretim ikonu */}
                  <path
                    d="M8 40V24L16 20V28L24 24V32L32 28V40H8Z"
                    fill="url(#gradient1)"
                    className="animate-slide-up"
                    style={{ animationDelay: "0.3s" }}
                  />
                  <path
                    d="M32 40V20L40 16V40H32Z"
                    fill="url(#gradient2)"
                    className="animate-slide-up"
                    style={{ animationDelay: "0.5s" }}
                  />
                  <rect
                    x="10"
                    y="32"
                    width="3"
                    height="5"
                    fill="#fff"
                    className="animate-fade-in"
                    style={{ animationDelay: "0.8s" }}
                  />
                  <rect
                    x="16"
                    y="32"
                    width="3"
                    height="5"
                    fill="#fff"
                    className="animate-fade-in"
                    style={{ animationDelay: "0.9s" }}
                  />
                  <rect
                    x="22"
                    y="32"
                    width="3"
                    height="5"
                    fill="#fff"
                    className="animate-fade-in"
                    style={{ animationDelay: "1s" }}
                  />
                  <rect
                    x="34"
                    y="32"
                    width="3"
                    height="5"
                    fill="#fff"
                    className="animate-fade-in"
                    style={{ animationDelay: "1.1s" }}
                  />

                  <defs>
                    <linearGradient id="gradient1" x1="8" y1="20" x2="32" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#3b82f6" />
                      <stop offset="1" stopColor="#2563eb" />
                    </linearGradient>
                    <linearGradient id="gradient2" x1="32" y1="16" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#f97316" />
                      <stop offset="1" stopColor="#ea580c" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Dönen halka */}
                <div className="absolute -inset-2 border-2 border-accent rounded-full animate-spin-slow opacity-30" />
              </div>

              {/* Logo text */}
              <div className="flex flex-col animate-fade-in" style={{ animationDelay: "0.6s" }}>
                <span className="text-3xl font-bold text-primary tracking-tight">
                  mira
                  <span className="text-accent">app</span>
                </span>
                <span className="text-xs text-muted-foreground tracking-wider uppercase"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Yükleme çubuğu */}
        <div className="w-64 h-1 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full animate-loading-bar" />
        </div>

        {/* Yükleniyor metni */}
        <div className="text-gray-700 text-sm font-medium animate-pulse">Sistem başlatılıyor...</div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fade-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          0% {
            transform: translateY(10px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes loading-bar {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }

        @keyframes spin-slow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .animate-scale-in {
          animation: scale-in 0.6s ease-out forwards;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-loading-bar {
          animation: loading-bar 3s ease-in-out forwards;
        }

        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  )
}
