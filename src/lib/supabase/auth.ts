import { cache } from "react";
import { createClient } from "./server";

/**
 * Deduplicate the authenticated-user lookup shared by a dashboard layout and
 * its child page during one App Router render. The cache is request-scoped by
 * React, so it does not share one visitor's user with another visitor.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});
