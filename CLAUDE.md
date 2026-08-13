# Oscar Mairey - Personal Website

## Design Context

### Users
Visitors are investors, fellow entrepreneurs, tech community members, and potential collaborators discovering Oscar Mairey. They arrive from LinkedIn, Twitter, or conference follow-ups, looking to quickly understand who Oscar is, what he's built, and whether to engage further. The site must earn credibility in seconds.

### Brand Personality
**Refined, intellectual, ambitious.** The voice is that of a young founder who thinks deeply (stoicism, philosophy of technology) but moves fast (crypto, AI, multiple ventures). Confident without being boastful. The tone bridges European sophistication with startup urgency.

**Emotional goals:** Visitors should feel confidence and authority — this person is serious and established — combined with energy and ambition — this person is building the future right now.

### Aesthetic Direction
**Visual tone:** Clean, content-forward, with intentional moments of boldness. Think personal intellectual site, not agency portfolio.

**References:**
- **Patrick Collison's site** — personal, intellectual, content-forward. Ideas take center stage, design gets out of the way.
- **Balaji Srinivasan's site** — tech-forward, ideas-driven, bold. Unapologetic about big thinking.

**Anti-references (avoid all of these):**
- Generic portfolio templates — cookie-cutter layouts, stock illustrations, "hello I'm a developer" energy
- Over-designed agency sites — gratuitous parallax, animations for animation's sake, style over substance
- Corporate / enterprise — stiff, impersonal, committee-designed
- Crypto-bro aesthetic — neon gradients, dark-mode-only, overly flashy, hype over depth

**Theme:** Light mode default, dark mode supported. Purple primary accent.

### Design Principles

1. **Substance over spectacle** — Every design decision should serve the content. Animations and effects must earn their place by improving comprehension or feel, never just decorating.

2. **Intellectual confidence** — The design should project authority through restraint and precision, not through loudness. White space, typography hierarchy, and careful color use convey more than effects.

3. **Personal, not templated** — The site should feel like it was built *by* Oscar, not *for* him. Avoid patterns that scream "portfolio template." Unique compositional choices over safe grid layouts.

4. **Forward momentum** — Reflect ambition and energy through pacing, rhythm, and progressive disclosure. The experience should pull visitors through the narrative, not just present sections.

5. **Cross-context credibility** — Must feel equally at home when shared in a VC pitch deck, a conference bio, or a crypto community. Never too casual, never too corporate.

### Technical Design Tokens
- **Primary:** Purple (HSL 262.1 83.3% 57.8% light / 263.4 70% 50.4% dark)
- **Fonts:** Montserrat (body, loaded via Next.js), Inter (sans fallback), DM Sans (secondary), Raleway (headings)
- **Border radius:** 1rem base
- **Animations:** Framer Motion with scroll-triggered reveals, staggered children
- **Component library:** shadcn/ui (Radix + CVA + Tailwind)
