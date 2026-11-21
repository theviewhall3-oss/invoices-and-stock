import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";

const GROUPS = [
  [{ to: "/", label: "Dashboard" }],
  [
    { to: "/quotes", label: "Quotes" },
    { to: "/invoices", label: "Invoices" },
    { to: "/payments", label: "Payments" },
    { to: "/clients", label: "Clients" },
  ],
  [
    { to: "/products", label: "Products and services" },
    { to: "/suppliers", label: "Suppliers" },
    { to: "/purchases", label: "Purchases" },
    { to: "/expenses", label: "Expenses" },
  ],
  [
    { to: "/reports", label: "Reports" },
    { to: "/settings", label: "Settings" },
  ],
] as const;

const LINKS = GROUPS.flat();

/** The app's sections, in one menu beside the way back to the Gateway. */
export function AppNav() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const current =
    [...LINKS]
      .reverse()
      .find((link) =>
        link.to === "/" ? path === "/" : path.startsWith(link.to),
      ) ?? LINKS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label="Menu" className="gap-1.5" />
        }
      >
        <Menu aria-hidden />
        <span className="truncate">{current.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {GROUPS.map((group, index) => (
          <div key={group[0].to}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {group.map((link) => (
              <DropdownMenuItem key={link.to} render={<Link to={link.to} />}>
                {link.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
