import { useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveRawFile } from "@/lib/tauri";
import { toast } from "sonner";

interface ClarificationRawProps {
  filePath: string;
  initialContent: string;
  onSaved: () => void;
}

export function ClarificationRaw({
  filePath,
  initialContent,
  onSaved,
}: ClarificationRawProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveRawFile(filePath, content);
      toast.success("File saved");
      onSaved();
    } catch (err) {
      toast.error(
        `Failed to save: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-medium">Could not parse Q&A format</p>
          <p className="text-muted-foreground">
            Edit the raw markdown below and save. File:{" "}
            <code className="text-xs">{filePath}</code>
          </p>
        </div>
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 min-h-0 font-mono text-sm resize-none"
        rows={20}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
