import { Badge } from "@/client/components/ui/badge";

const LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  invoiced: "Invoiced",
  expired: "Expired",
  void: "Void",
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  received: "Received",
};

const VARIANTS: Record<
  string,
  "secondary" | "info" | "success" | "warning" | "destructive" | "outline"
> = {
  draft: "secondary",
  sent: "info",
  accepted: "success",
  declined: "destructive",
  invoiced: "outline",
  expired: "warning",
  void: "outline",
  unpaid: "info",
  partially_paid: "warning",
  paid: "success",
  overdue: "destructive",
  received: "success",
};

function statusLabel(status: string): string {
  return LABELS[status] ?? status;
}

export function StatusBadge({
  status,
  testId,
}: {
  status: string;
  testId?: string;
}) {
  return (
    <Badge variant={VARIANTS[status] ?? "secondary"} data-testid={testId}>
      {statusLabel(status)}
    </Badge>
  );
}
