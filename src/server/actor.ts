import { eq, type SQL, type Column } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/** The signed-in member as the queries see them. */
export interface Actor {
  id: string;
  email: string;
  admin: boolean;
}

/** A message the person may read, as opposed to an internal failure. */
class UserError extends Error {}

export function fail(message: string): never {
  throw new UserError(message);
}

/** Records a member the first time the app sees them. */
export async function rememberUser(actor: Actor): Promise<void> {
  await db
    .insert(users)
    .values({ id: actor.id, email: actor.email })
    .onConflictDoNothing();
}

/** Admins see every row; anyone else only the rows they own. */
export function ownedBy(actor: Actor, column: Column): SQL | undefined {
  return actor.admin ? undefined : eq(column, actor.id);
}

export function requireAdmin(actor: Actor): void {
  if (!actor.admin) fail("Only an admin can do that.");
}

export function newId(): string {
  return crypto.randomUUID();
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
