import type { MetadataRoute } from "next";

import { SEO_URL } from "@/lib/env";

const sitemap = (): MetadataRoute.Sitemap => {
  const base = SEO_URL;
  const lastModified = new Date();

  return [
    {
      changeFrequency: "monthly",
      lastModified,
      priority: 1,
      url: `${base}/`,
    },
  ];
};

export default sitemap;
