import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Expenses",
    short_name: "Expenses",
    description: "Personal accounts, cards and spending",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15122e",
    theme_color: "#15122e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
