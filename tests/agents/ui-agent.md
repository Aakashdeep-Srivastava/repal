# UI, Responsive & Accessibility Agent

Checks desktop + mobile layouts, navigation, responsive behavior, accessibility, and broken interactions across RePal's mobile-responsive Next.js UI.

## Scope
Pages: `/`, `/shop`, `/product/[id]`, `/wallet`, `/mandate`, `/insights`, `/checkout`, `/stack`, `/rescue`. Use Playwright projects: Desktop Chromium, Mobile Chromium (Pixel), WebKit/Safari.

## Scenarios → expected
| Area | Expected |
|---|---|
| Desktop layout | Nav, tables, dashboards, cards render; no horizontal overflow |
| Mobile layout (≤640px) | Bottom nav/scroll, forms, safe areas, checkout usable |
| Signed-in identity | Persona name/avatar visible in the shell *(current gap F1: `UserMenu` exists but is never mounted; shell shows "Guest")* |
| Navigation | All sidebar links resolve; active state correct |
| Reduced motion | Journey fully functional with `prefers-reduced-motion` |
| Accessibility | Headings/roles/labels present; interactive elements reachable; images have alt/aria |
| Theme | Light/dark toggle works |

## Evidence
Screenshots at desktop + mobile widths, accessibility snapshot (role tree), Playwright trace on failure.

## Existing coverage
`e2e/home.spec.ts`, `e2e/shopping-journey.spec.ts` (incl. reduced-motion + mid-checkout refresh). Gaps: dedicated Mobile Chromium + WebKit projects (config currently ships Chromium desktop only), automated a11y assertions.
