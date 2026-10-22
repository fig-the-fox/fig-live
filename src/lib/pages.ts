// The site's pages, in nav order. Trailing slashes match `trailingSlash: true` in next.config.ts,
// which exports each page as <path>/index.html so any static host (and `serve`) finds it.
export const PAGES = [
  { href: "/", label: "Home" },
  { href: "/kit/", label: "Use the kit" },
  { href: "/next/", label: "What's next" },
  { href: "/receipts/", label: "Receipts" },
] as const;
