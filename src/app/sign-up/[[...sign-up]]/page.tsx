"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-6 py-12">
      <div className="mx-auto flex max-w-md flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Create account</h1>
        <SignUp routing="path" path="/sign-up" />
      </div>
    </div>
  );
}
