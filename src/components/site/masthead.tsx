"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav, site } from "@/content/site";

/** Name on the left, three sections on the right, one hairline under it.
 *  On the home page the name is the page's h1; elsewhere it is a link back. */
export default function Masthead() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header className="mast">
      {isHome ? (
        <h1 className="mast-name">{site.name}</h1>
      ) : (
        <Link className="mast-name" href="/">
          {site.name}
        </Link>
      )}
      <nav aria-label="Sections">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
