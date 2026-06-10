import { Suspense } from "react";

import Link from "next/link";

import { ArrowRight, Workflow } from "lucide-react";

import { LoginForm } from "./_components/login-form";

/** The multicolor Google "G". */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.16 7.16 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center p-4 sm:p-8">
      {/* Floating shell card */}
      <div className="bg-card border-border/60 grid w-full max-w-[1100px] grid-cols-1 overflow-hidden rounded-3xl border p-3 shadow-2xl lg:min-h-[640px] lg:grid-cols-2">
        {/* ── Left: atmospheric brand panel ──
            Bottom fades to near-black in every theme so the tagline (white)
            always has contrast — primary-foreground can be dark on orange. */}
        <div className="from-primary via-primary/80 relative hidden flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-b to-black/90 p-8 lg:flex">
          {/* Dunes */}
          <svg
            viewBox="0 0 600 800"
            preserveAspectRatio="xMidYMax slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <path d="M0 470 Q 170 330 340 480 T 600 430 V 800 H 0 Z" fill="black" opacity="0.18" />
            <path d="M0 560 Q 200 430 400 590 T 600 540 V 800 H 0 Z" fill="black" opacity="0.28" />
            <path d="M0 660 Q 240 540 460 690 T 600 650 V 800 H 0 Z" fill="black" opacity="0.4" />
          </svg>

          {/* Header row */}
          <div className="relative flex items-start justify-between">
            <div className="text-primary-foreground flex items-center gap-2">
              <Workflow className="size-6" />
              <span className="text-lg font-semibold tracking-[0.18em]">DEEPFLOW</span>
            </div>
            <Link
              href="/landing"
              className="border-primary-foreground/30 text-primary-foreground/90 hover:bg-primary-foreground/10 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
            >
              Back to website
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* Tagline + dots — white on the forced-dark bottom of the panel. */}
          <div className="relative space-y-6">
            <p className="text-4xl leading-tight font-light tracking-tight text-white">
              Orchestrating processes,
              <br />
              empowering people.
            </p>
            <div className="flex items-center gap-2">
              <span className="h-1 w-6 rounded-full bg-white/30" />
              <span className="h-1 w-6 rounded-full bg-white/30" />
              <span className="h-1 w-10 rounded-full bg-white" />
            </div>
          </div>
        </div>

        {/* ── Right: form panel ── */}
        <div className="flex items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-3">
              {/* Mobile-only brand mark (left panel is hidden) */}
              <div className="text-foreground flex items-center gap-2 lg:hidden">
                <Workflow className="text-primary size-5" />
                <span className="text-sm font-semibold tracking-[0.18em]">DEEPFLOW</span>
              </div>
              <h1 className="text-4xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-muted-foreground text-sm">
                Sign in with your engine credentials. Fresh installs use{" "}
                <code className="bg-muted rounded px-1 py-0.5">demo</code> /{" "}
                <code className="bg-muted rounded px-1 py-0.5">demo</code>.
              </p>
            </div>

            <Suspense fallback={<div className="h-40" />}>
              <LoginForm />
            </Suspense>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="bg-border h-px flex-1" />
                <span className="text-muted-foreground text-xs">Or continue with</span>
                <span className="bg-border h-px flex-1" />
              </div>
              <button
                type="button"
                disabled
                title="Google SSO arrives in a later wave"
                className="border-border text-foreground/80 flex h-10 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-md border text-sm font-medium opacity-70"
              >
                <GoogleMark />
                Google
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
