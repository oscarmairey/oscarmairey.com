import type { Metadata } from "next";
import "./admin.css";

/** The editor sits inside the site's own shell: the masthead above it is the
 *  site's, the column is the site's, and there is no second navigation. What
 *  the editor adds is one stylesheet.
 *
 *  Nothing under /admin is ever indexed: this header, a Disallow in robots.ts,
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="adm">{children}</div>;
}
