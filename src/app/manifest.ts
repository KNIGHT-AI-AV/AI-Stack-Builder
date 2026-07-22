import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AI Stack Builder by Knight AI+AV",
    short_name: "Stack Builder",
    description: "Turn a product idea into a connected AI architecture graph.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#08080a",
    theme_color: "#08080a",
    categories: ["developer", "productivity", "utilities"],
    icons: [
      {
        src: "/assets/brand/icons/ai-stack-builder-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/brand/icons/ai-stack-builder-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/brand/icons/ai-stack-builder-icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/assets/brand/icons/ai-stack-builder-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
