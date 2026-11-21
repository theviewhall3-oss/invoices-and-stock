import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { invoiceByToken } from "@/server/invoices";
import { quoteByToken } from "@/server/quotes";

// The share pages' data: no identity, only the token in the link. Their
// loaders run on the server when the page renders, so a visitor who isn't
// signed in never calls these over the network.
const token = (data: unknown) =>
  z.object({ token: z.string().min(10).max(100) }).parse(data);

export const getSharedQuote = createServerFn()
  .validator(token)
  .handler(({ data }) => quoteByToken(data.token));

export const getSharedInvoice = createServerFn()
  .validator(token)
  .handler(({ data }) => invoiceByToken(data.token));
