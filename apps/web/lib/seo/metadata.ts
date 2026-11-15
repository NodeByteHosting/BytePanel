import merge from "lodash.merge";
import type { Metadata } from "next";

import { SEO_URL } from "@/lib/env";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
  bareTitle?: boolean;
  siteName?: string;
};

const DEFAULT_SITE_NAME = "BytePanel";

export const createMetadata = ({
  title,
  description,
  image,
  bareTitle,
  siteName = DEFAULT_SITE_NAME,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = bareTitle ? title : `${title} | ${siteName}`;
  const author = { name: siteName };
  const defaultMetadata: Metadata = {
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    applicationName: siteName,
    authors: [author],
    creator: author.name,
    description,
    formatDetection: {
      telephone: false,
    },
    metadataBase: new URL(SEO_URL),
    openGraph: {
      description,
      locale: "en_US",
      siteName,
      title: parsedTitle,
      type: "website",
    },
    publisher: siteName,
    title: parsedTitle,
    twitter: {
      card: "summary_large_image",
    },
  };

  const metadata: Metadata = merge(defaultMetadata, properties);

  if (image && metadata.openGraph) {
    metadata.openGraph.images = [
      {
        alt: title,
        height: 630,
        url: image,
        width: 1200,
      },
    ];
  }

  return metadata;
};
