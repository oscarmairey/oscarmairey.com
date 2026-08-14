import { site } from "@/content/site";

/** The whole contact surface of the site: three links and an address. No
 *  photograph, no date, nothing that has to be kept true by hand. */
export default function Footer() {
  return (
    <footer className="site-footer">
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
    </footer>
  );
}
