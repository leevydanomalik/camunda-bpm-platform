import { Suspense } from "react";

import { Workflow } from "lucide-react";

import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:block lg:w-1/3">
        <div className="flex h-full flex-col items-center justify-center p-12 text-center">
          <div className="space-y-6">
            <Workflow className="mx-auto size-12 text-primary-foreground" />
            <div className="space-y-2">
              <h1 className="font-light text-5xl text-primary-foreground">Camunda</h1>
              <p className="text-primary-foreground/80 text-xl">Process orchestration platform</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-8 lg:w-2/3">
        <div className="w-full max-w-md space-y-10 py-24 lg:py-32">
          <div className="space-y-4 text-center">
            <div className="font-medium tracking-tight">Sign in</div>
            <div className="mx-auto max-w-xl text-muted-foreground">
              Use your Camunda engine credentials. Default for fresh installs:{" "}
              <code className="bg-muted rounded px-1">demo</code> / <code className="bg-muted rounded px-1">demo</code>.
            </div>
          </div>
          <Suspense fallback={<div className="h-40" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
