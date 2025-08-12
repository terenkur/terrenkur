export const ROLE_ICONS: Record<string, string> = {
  Streamer: "/icons/roles/broadcaster.svg",
  Mod: "/icons/roles/moderator.svg",
  VIP: "/icons/roles/vip.svg",
};

export function getSubBadge(months: number): string | undefined {
  const m = Math.floor(months);
  if (m < 1) return undefined;

  const badge =
    m >= 24 ? 24 :
    m >= 18 ? 18 :
    m >= 12 ? 12 :
    m >= 9 ? 9 :
    m >= 6 ? 6 :
    m >= 3 ? 3 :
    m >= 2 ? 2 :
    1;

  return `/icons/subs/${badge}.svg`;
}
