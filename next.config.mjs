/** @type {import('next').NextConfig} */

/* The site is always reached through Caddy, never on its own port, so both
   origin checks Next makes have to know the domains it answers on. */
const domains = ["oscarmairey.com", "www.oscarmairey.com", "dev.oscarmairey.com"];

const nextConfig = {
  output: 'standalone',

  /* Dev only. Without this, Next blocks cross-origin requests to /_next/*,
     which includes the HMR socket — and a dev client that cannot open that
     socket never finishes hydrating, so nothing on the page is interactive. */
  allowedDevOrigins: domains,

  experimental: {
    serverActions: {
      /* The CSRF check compares Origin against the host Next believes it is
         serving. Behind a proxy those differ the moment a header is rewritten,
         and every save fails. Naming the domains makes it independent of that. */
      allowedOrigins: domains,
    },
  },
}

export default nextConfig
