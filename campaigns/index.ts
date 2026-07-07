/**
 * Campaign registry + loader.
 *
 * The runtime resolves SALON_CAMPAIGN → one of these definitions at boot.
 * Unknown ids fail FAST and LOUD — a storefront that doesn't know which
 * campaign it is must never serve a page.
 *
 * Adding a storefront: write <id>.campaign.ts, register it here, deploy
 * with SALON_CAMPAIGN=<id>. No build change, no code change elsewhere.
 */

import type { CampaignDefinition } from "../src/lib/campaign";
import { directory } from "./directory.campaign";
import { national } from "./national.campaign";
import { orlando } from "./orlando.campaign";

export const CAMPAIGNS: Record<string, CampaignDefinition> = {
  [orlando.id]: orlando,
  [national.id]: national,
  [directory.id]: directory,
};

export const CAMPAIGN_IDS = Object.keys(CAMPAIGNS);

export function resolveCampaign(id: string): CampaignDefinition {
  const campaign = CAMPAIGNS[id];
  if (!campaign) {
    throw new Error(
      `Unknown SALON_CAMPAIGN "${id}" — known campaigns: ${CAMPAIGN_IDS.join(", ")}`,
    );
  }
  return campaign;
}
