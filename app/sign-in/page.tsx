import SignInForm from "@/components/auth/SignInForm"
import { safeNextPath } from "@/lib/auth/sign-in"

export const dynamic = "force-dynamic"

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next)
  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-950">
      <section className="mx-auto max-w-sm rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Operator sign-in</h1>
        <p className="mt-2 text-sm text-gray-600">For authorised Brik-by-Brik operators only.</p>
        <SignInForm next={next} />
      </section>
    </main>
  )
}
