import type { User } from "@supabase/supabase-js";

export const isModeratorFromSession = (user?: User | null) => {
  if (!user) return false;
  if (user.app_metadata?.is_moderator) return true;
  if (user.user_metadata?.is_moderator) return true;
  if (user.app_metadata?.role === "moderator") return true;
  const roles = user.app_metadata?.roles;
  return Array.isArray(roles) && roles.includes("moderator");
};
