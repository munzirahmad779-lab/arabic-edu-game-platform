import type { User } from "@supabase/supabase-js";

/** The only account allowed to use super-admin controls. */
export const SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL ?? "munzirahmad779@gmail.com"
).trim().toLowerCase();

export function isSuperAdmin(user: Pick<User, "email"> | null | undefined): boolean {
  return Boolean(user?.email && user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL);
}
