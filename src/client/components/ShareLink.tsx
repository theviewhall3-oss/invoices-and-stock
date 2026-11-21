import { CopyButton } from "@/client/components/CopyButton";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";

/** The address a client opens without signing in. */
export function ShareLink({ url, label }: { url: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="share-link">{label}</Label>
      <div className="flex gap-2">
        <Input id="share-link" data-testid="share-link" readOnly value={url} className="bg-card" onFocus={(event) => event.target.select()} />
        <CopyButton value={url} successMessage="Link copied" />
      </div>
    </div>
  );
}
