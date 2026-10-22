import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { SHARE_DESCRIPTION, SHARE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

// Fonts are downloaded at build time and served from this site, so the page makes no runtime font requests.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

// The share image itself comes from src/app/opengraph-image.png and twitter-image.png
// (rendered by scripts/build-og.mjs); Next adds those tags with absolute URLs from metadataBase.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SHARE_TITLE, template: "%s · Fig Live" },
  description: SHARE_DESCRIPTION,
  // Matches the Referrer-Policy header in vercel.json. Data fetches to Web4 / DexScreener still send no referrer.
  referrer: "strict-origin-when-cross-origin",
  openGraph: {
    type: "website",
    siteName: "Fig Live",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    site: "@AskFigFox",
    creator: "@AskFigFox",
  },
};

export const viewport: Viewport = {
  themeColor: "#2b1430",
  colorScheme: "dark",
};

// The page only talks to Web4 and DexScreener, and only loads images from itself and Web4.
// Applied in production builds only (next dev needs eval for hot reload).
// Keep in sync with the Content-Security-Policy header in vercel.json (which adds frame-ancestors,
// since a meta CSP can't set it). scripts/verify.mjs fails if the two drift apart.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://web-4.app",
  "font-src 'self'",
  "connect-src 'self' https://web-4.app https://api.dexscreener.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable}`}>
      <head>{process.env.NODE_ENV === "production" ? <meta httpEquiv="Content-Security-Policy" content={CSP} /> : null}</head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ember focus:px-3 focus:py-2 focus:text-plum">
          Skip to content
        </a>
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-8">
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
