"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface SplashScreenProps {
  autoHide?: boolean;
  onHide?: () => void;
  isLogout?: boolean;
}

const SPLASH_DURATION_MS = 2500;

export default function SplashScreen({ autoHide = true, onHide, isLogout = false }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!autoHide) return;

    const timer = window.setTimeout(() => {
      setIsVisible(false);
      onHide?.();
    }, SPLASH_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [autoHide, onHide]);

  if (!isVisible) return null;

  const title = isLogout ? "Oturum Kapatiliyor" : "Oturum Aciliyor";
  const subtitle = isLogout ? "Guvenli cikis hazirlaniyor..." : "Guvenli calisma alani hazirlaniyor...";

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,64,175,0.2),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(148,163,184,0.14)_1px,transparent_1px)] [background-size:38px_38px]" />
      <div className="absolute -left-20 top-20 h-56 w-56 rounded-full bg-blue-200/60 blur-3xl animate-float-slow" />
      <div className="absolute -right-14 bottom-14 h-52 w-52 rounded-full bg-slate-300/60 blur-3xl animate-float-slower" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-8 shadow-[0_28px_70px_-36px_rgba(15,23,42,0.6)] backdrop-blur-sm md:p-10">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <Image
                src="/miraapp-logo.jpg"
                alt="MiraApp Logo"
                fill
                className="object-cover"
                priority
                sizes="64px"
              />
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                MiraApp
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 animate-brand-text">miraap</h1>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200/80 pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">{title}</p>
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-700 via-blue-500 to-cyan-400 animate-progress-sweep" />
            </div>
          </div>

          <p className="mt-8 text-[0.64rem] uppercase tracking-[0.2em] text-slate-400">
            Copyright {new Date().getFullYear()} Mira Software Solutions
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress-sweep {
          0% {
            transform: translateX(-130%);
          }
          70% {
            transform: translateX(110%);
          }
          100% {
            transform: translateX(240%);
          }
        }

        @keyframes float-slow {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-14px);
          }
        }

        @keyframes float-slower {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(10px);
          }
        }

        .animate-progress-sweep {
          animation: progress-sweep 2.35s cubic-bezier(0.25, 0.7, 0.3, 1) infinite;
        }

        .animate-float-slow {
          animation: float-slow 7s ease-in-out infinite;
        }

        .animate-float-slower {
          animation: float-slower 8.2s ease-in-out infinite;
        }

        @keyframes brand-text {
          0%,
          100% {
            transform: translateY(0);
            letter-spacing: 0.01em;
            text-shadow: 0 0 0 rgba(37, 99, 235, 0);
          }
          50% {
            transform: translateY(-2px);
            letter-spacing: 0.04em;
            text-shadow: 0 6px 18px rgba(37, 99, 235, 0.28);
          }
        }

        .animate-brand-text {
          display: inline-block;
          animation: brand-text 2.1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
