import "server-only";
import { env } from "@/lib/env";

export interface StoreProduct {
  bytepanel: {
    can_select_game: boolean;
    can_select_location: boolean;
    egg_id: string | null;
    location_id: string | null;
    plan_id: string | null;
  };
  category: { name: string; slug: string } | null;
  id: number;
  image_url: string | null;
  in_stock: boolean;
  name: string;
  slug: string | null;
  starting_from: {
    free: boolean;
    plan: { name: string | null };
    price: { formatted: string } | null;
  } | null;
}

export const listStoreProducts = async (): Promise<StoreProduct[] | null> => {
  if (!env.BYTEPAY_API_URL) {
    return null;
  }
  try {
    const res = await fetch(
      `${env.BYTEPAY_API_URL}/api/v1/bytepanel/products`,
      {
        headers: { accept: "application/json" },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { data: StoreProduct[] };
    return body.data;
  } catch (error) {
    console.error("Could not load BytePay products", error);
    return null;
  }
};
