import type React from "react";
import type { Metadata } from "next";
import { Literata } from "next/font/google";
import "./globals.css";
import Masthead from "@/components/site/masthead";
import Footer from "@/components/site/footer";
import { nav, site } from "@/content/site";
import { stocked } from "@/lib/content";
import { alternatesFor } from "@/lib/meta";

/** One family for the whole site: body, links, dates, headings, email.
 *  Literata carries an optical-size axis, so metadata at 14px and a title at
 *  34px are served by different cuts of the same face.
 *
 *  Naming weights would have asked for those cuts as static instances — three
 *  weights against two styles, none of them carrying opsz, which left
 *  `font-optical-sizing: auto` with nothing to size. Asking for the axis
 *  instead ships the variable face, where the weights are a range and the
 *  optical size follows the type. */
const literata = Literata({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-reading",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  alternates: alternatesFor("/"),
  openGraph: {
    type: "profile",
    siteName: site.name,
    title: site.name,
    description: site.ogDescription,
    url: site.url,
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.ogDescription,
    creator: "@oscarmairey",
  },
};

const personLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  email: `mailto:${site.email}`,
  jobTitle: "Algorithmic asset manager",
  worksFor: { "@type": "Organization", name: "ARTE One" },
  description: site.ogDescription,
  sameAs: site.links.map((l) => l.href),
};

/** Async because the masthead asks a question of the database: which lists
 *  have anything on them. It goes through the same thirty-second cache every
 *  page reads, so it costs nothing a page was not already paying, and it never
 *  throws. Every route under here is dynamic already. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const shown = await stocked();
  const links = nav.filter((item) => shown.some((section) => item.href === `/${section}`));

  return (
    <html lang="en">
      <body className={literata.variable}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="wrap">
          <Masthead links={links} />
          <main id="main">{children}</main>
          <Footer />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
        />
      </body>
    </html>
  );
}
