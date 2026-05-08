'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginCard() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  async function handleGoogleLogin() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header — matches home page */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Onboarding Assistant</p>
            <h1 className="text-lg font-semibold">Sign in</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        {/* Hero text — mirrors the home hero section */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 mb-6">
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Your AI-powered call assistant.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-slate-600">
            Real-time transcription, question tracking, and AI-generated summaries — all in one place. Sign in to get started.
          </p>
        </section>

        {/* Login card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 max-w-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500 mb-4">Authentication</p>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              Authentication failed. Please try again.
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-orange-300 bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition duration-150 hover:bg-orange-400 active:bg-orange-600"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </section>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="white"
        fillOpacity="0.9"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="white"
        fillOpacity="0.9"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="white"
        fillOpacity="0.9"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="white"
        fillOpacity="0.9"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
