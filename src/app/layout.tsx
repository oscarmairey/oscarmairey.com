import type React from "react";
import type { Metadata } from "next";
import { Literata } from "next/font/google";
import "./globals.css";
import Masthead from "@/components/site/masthead";
import Footer from "@/components/site/footer";
import { site } from "@/content/site";

/** One family for the whole site: body, links, dates, headings, email.
 *  Literata carries an optical-size axis, so metadata at 14px and a title at
 *  34px are served by different cuts of the same face. */
const literata = Literata({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-reading",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": [{ url: "/feed.xml", title: site.name }] },
  },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={literata.variable}>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="wrap">
          <Masthead />
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
