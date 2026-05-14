import merge from "lodash.merge";
import type { Metadata } from "next";

import { SEO_URL } from "@/lib/env";

type MetadataGenerator = Omit<Metadata, "description" | "title"> & {
  title: string;
  description: string;
  image?: string;
  /**
   * Skip appending " | NodeByte GSM" to the title. Use for the homepage where the
   * title already leads with the brand context.
   */
  bareTitle?: boolean;
};

const applicationName = "NodeByte Panel";
const author: Metadata["authors"] = {
  name: "NodeByte Hosting",
  url: "https://nodebyte.host",
};
const publisher = "NodeByte Hosting";
const twitterHandle = "@NodeByteHost";

export const createMetadata = ({
  title,
  description,
  image,
  bareTitle,
  ...properties
}: MetadataGenerator): Metadata => {
  const parsedTitle = bareTitle ? title : `${title} | ${applicationName}`;
  const defaultMetadata: Metadata = {
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: parsedTitle,
    },
    applicationName,
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
      siteName: applicationName,
      title: parsedTitle,
      type: "website",
    },
    publisher,
    title: parsedTitle,
    twitter: {
      card: "summary_large_image",
      creator: twitterHandle,
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
