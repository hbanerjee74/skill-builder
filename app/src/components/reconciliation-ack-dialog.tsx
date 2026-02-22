import { Info } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { DiscoveredSkill } from "@/lib/types"

interface ReconciliationAckDialogProps {
  notifications: string[]
  discoveredSkills: DiscoveredSkill[]
  open: boolean
  onAcknowledge: () => void
}

export default function ReconciliationAckDialog({
  notifications,
  discoveredSkills: _discoveredSkills,
  open,
  onAcknowledge,
}: ReconciliationAckDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Info className="size-5 text-blue-500" />
            Startup Reconciliation
          </AlertDialogTitle>
          <AlertDialogDescription>
            The following changes were made to keep the database in sync with
            files on disk.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea className="max-h-[300px]">
          <ul className="flex flex-col gap-2 py-2">
            {notifications.map((notification, i) => (
              <li
                key={i}
                className="rounded-md border px-3 py-2 text-sm text-foreground"
              >
                {notification}
              </li>
            ))}
          </ul>
        </ScrollArea>

        <AlertDialogFooter>
          <AlertDialogAction onClick={onAcknowledge}>
            Acknowledge
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
