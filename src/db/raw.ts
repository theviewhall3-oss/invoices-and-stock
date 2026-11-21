import { env } from "cloudflare:workers";

/**
 * Plain statements run together in one D1 batch, which D1 applies as a
 * transaction. For changes whose later statements depend on the first.
 */
export function batch(statements: [string, ...unknown[]][]) {
  return env.DB.batch(
    statements.map(([query, ...values]) => env.DB.prepare(query).bind(...values)),
  );
}
