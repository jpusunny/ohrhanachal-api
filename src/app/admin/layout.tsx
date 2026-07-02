import Link from "next/link";
import { getSession } from "@/lib/session";
import LogoutButton from "./LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold">
              Ohr Hanachal
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/admin/products" className="hover:text-black">
                Products
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            {session && <span>{session.email}</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
