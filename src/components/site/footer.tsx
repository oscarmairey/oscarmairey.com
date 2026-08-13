"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { site } from "@/content/site";
import photo from "../../../public/photo.png";

/** The whole contact surface of the site: three links, an address, a date.
 *  The portrait appears on the home page only: one photograph on the site. */
export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className="site-footer">
      {pathname === "/" && (
        <Image
          className="portrait"
          src={photo}
          alt={`${site.name}.`}
          width={96}
          height={96}
          sizes="96px"
        />
      )}
      <div>
        <p>
          {site.links.map((link, i) => (
            <span key={link.href}>
              {i > 0 && (
                <span className="dot" aria-hidden="true">
                  ·
                </span>
              )}
              <a href={link.href} rel="me noopener noreferrer">
                {link.label}
              </a>
            </span>
          ))}
          <span className="dot" aria-hidden="true">
            ·
          </span>
          <a className="mail" href={`mailto:${site.email}`}>
            {site.email}
          </a>
        </p>
        <p>Last updated {site.lastUpdated}.</p>
      </div>
    </footer>
  );
}
