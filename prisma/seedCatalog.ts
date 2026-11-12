/**
 * Seeds the cold-start rewards catalog (Merchant + CatalogOffer) from the code
 * source of truth in lib/merchants/catalog.ts. Idempotent (upsert), so it is
 * safe to re-run — it refreshes relative expiries so seeded offers never go
 * stale. In production these rows come from affiliate/card-linked adapters; the
 * shape is identical, so nothing downstream changes.
 */
import type { PrismaClient } from "@prisma/client";
import { MERCHANTS, CATALOG } from "../lib/merchants/catalog";

export async function seedCatalog(prisma: PrismaClient): Promise<{ merchants: number; offers: number }> {
  for (const m of MERCHANTS) {
    await prisma.merchant.upsert({
      where: { id: m.id },
      create: { id: m.id, name: m.name, domain: m.domain, category: m.category, countries: m.countries },
      update: { name: m.name, domain: m.domain, category: m.category, countries: m.countries },
    });
  }

  const now = Date.now();
  for (const o of CATALOG) {
    const expiresAt = new Date(now + o.expiresInDays * 86_400_000);
    const data = {
      merchantId: o.merchantId,
      source: o.source,
      network: o.network ?? null,
      type: o.type,
      value: o.value,
      minSpendUsd: o.minSpendUsd ?? null,
      maxRewardUsd: o.maxRewardUsd ?? null,
      audience: o.audience,
      termsRaw: o.termsRaw,
      popularity: o.popularity,
      expiresAt,
      isSample: o.source !== "repal", // RePal's own welcome reward is real
    };
    await prisma.catalogOffer.upsert({ where: { id: o.id }, create: { id: o.id, ...data }, update: data });
  }

  return { merchants: MERCHANTS.length, offers: CATALOG.length };
}
