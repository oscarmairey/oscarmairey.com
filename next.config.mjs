/** @type {import('next').NextConfig} */

/* The site is always reached through Caddy, never on its own port, so both
   origin checks Next makes have to know the domains it answers on. */
const domains = ["oscarmairey.com", "www.oscarmairey.com", "dev.oscarmairey.com"];

const nextConfig = {
  output: 'standalone',

  /* The test harness builds and serves a second copy of the site against a
     throwaway database, and two of them sharing one build directory tread on
     each other. It sets this so the one Oscar is using is never disturbed. */
  distDir: process.env.NEXT_DIST_DIR || '.next',

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

    /* A test build happens on a four-core box that is also running Oscar's dev
       server, the live site, Postgres and his editor. One worker takes longer
       and leaves the machine to him while it does. */
    ...(process.env.NEXT_TEST_BUILD ? { cpus: 1, workerThreads: false } : {}),
  },
}

export default nextConfig
