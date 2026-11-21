import { createMiddleware } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { rememberUser, type Actor } from "@/server/actor";

/**
 * The signed-in member as an `Actor`: their Gateway id and email, and
 * whether the organization made them an admin. Recorded on first sight.
 */
export const actorMiddleware = createMiddleware({ type: "function" })
  .middleware([ensureUserMiddleware])
  .server(async ({ next, context }) => {
    const actor: Actor = {
      id: context.user.id,
      email: context.user.email,
      admin: isAdmin(context.user),
    };
    await rememberUser(actor);
    return next({ context: { actor } });
  });
