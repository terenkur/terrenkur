export const ROLE_ICONS: Record<string, string> = {
  Streamer: "/icons/roles/broadcaster.svg",
  Mod: "/icons/roles/moderator.svg",
  VIP: "/icons/roles/vip.svg",
};

export function getSubBadge(months: number): string {
  const badge = Math.min(Math.max(Math.floor(months) || 1, 1), 8);
  return `/icons/roles/${badge}.svg`;
}
