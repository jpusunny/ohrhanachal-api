import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Ohr Hanachal</h1>
      <p className="mt-3 text-gray-600">Commerce backend and admin console.</p>
      <div className="mt-6 flex gap-3">
        <Link className="rounded bg-black px-4 py-2 text-sm font-medium text-white" href="/admin">
          Admin
        </Link>
        <Link className="rounded border border-gray-300 px-4 py-2 text-sm" href="/login">
          Log in
        </Link>
      </div>
    </main>
  );
}
