import { getRouteApi } from "@tanstack/react-router";
import { formatMoney } from "@/lib/format";

const app = getRouteApi("/_app");

export function useSession() {
  return app.useLoaderData();
}

/** Formats cents in the business's currency. */
export function useMoney() {
  const { business } = useSession();
  return (cents: number) => formatMoney(cents, business.currencyCode);
}
