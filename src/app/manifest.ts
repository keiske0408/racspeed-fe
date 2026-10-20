import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rotaract Club Operations Platform",
    short_name: "Rotaract Ops",
    description: "Mobile-first operations platform for Rotaract San Pedro East (District 3820)",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0F172A",
    theme_color: "#E11D48",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
