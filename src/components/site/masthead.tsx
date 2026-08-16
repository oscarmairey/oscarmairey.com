"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav, site } from "@/content/site";

/** Name on the left, the sections on the right, one hairline under it.
 *  On the home page the name is the page's h1; elsewhere it is a link back.
 *
 *  Which sections there are is not this component's business: it is handed the
 *  ones that have something on them, because a list nobody has published into
 *  is not worth a word in a nav of three. The layout counts; this prints. */
export default function Masthead({ links = nav }: { links?: typeof nav }) {
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
        {links.map((item) => (
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
