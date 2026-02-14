import { useEffect, useState } from "react"
import { getVersion } from "@tauri-apps/api/app"
import { openUrl } from "@tauri-apps/plugin-opener"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const [version, setVersion] = useState("dev")

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion("dev"))
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <div className="flex flex-col items-center gap-4 pt-2">
            <img
              src="/icon-256.png"
              alt="Skill Builder"
              className="size-16 rounded-xl"
            />
            <div className="flex flex-col items-center gap-1">
              <DialogTitle className="text-center">Skill Builder</DialogTitle>
              <DialogDescription className="text-center">
                Version {version}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <p className="text-sm text-muted-foreground">
            Build domain-specific Claude skills with AI-powered multi-agent workflows.
          </p>
          <p className="text-sm text-muted-foreground">
            by{" "}
            <button
              className="underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => openUrl("https://acceleratedata.ai")}
            >
              Accelerate Data
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
