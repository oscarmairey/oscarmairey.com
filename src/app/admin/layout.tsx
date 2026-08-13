import type { Metadata } from "next";
import Link from "next/link";
import "./admin.css";
import { signedIn } from "@/lib/auth";
import { signOut } from "./actions";

/** Nothing under /admin is ever indexed: this header, a Disallow in robots.ts,
 *  and the sitemap listing public routes only. */
export const metadata: Metadata = {
  title: { default: "Editor", template: "%s · Editor" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await signedIn();

  return (
    <div className="adm">
      {authed && (
        <header className="adm-bar">
          <Link className="adm-here" href="/admin">
            Editor
          </Link>
          <nav aria-label="Editor">
            <Link href="/admin">Writings</Link>
            <Link href="/admin/books">Books</Link>
            <Link href="/">Site</Link>
            <form action={signOut}>
              <button className="adm-btn quiet" type="submit">
                Sign out
              </button>
            </form>
          </nav>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
