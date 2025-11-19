// TODO: Migrate to shadcn/ui components (Button, Input, Label, Alert, Card)
"use client";

import { login } from "@/modules/auth/session-actions";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, {});

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="text-center text-3xl font-bold">Sign in to Draehi</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Deploy your Logseq graph to the web
          </p>
        </div>

        {state?.error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{state.error}</p>
          </div>
        )}

        <form action={formAction} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                disabled={isPending}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                disabled={isPending}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-black focus:border-black disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-center text-sm">
            <Link href="/signup" className="text-gray-600 hover:text-black">
              Don&apos;t have an account? Sign up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
