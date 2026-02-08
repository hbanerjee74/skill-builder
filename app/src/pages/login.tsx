import { useState, useEffect, useCallback, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { openUrl } from "@tauri-apps/plugin-opener"
import { Sparkles, Loader2, Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  DeviceFlowResponse,
  DeviceFlowPollResult,
  GitHubUser,
} from "@/lib/types"

type LoginState =
  | { step: "idle" }
  | { step: "loading" }
  | { step: "device_code"; flow: DeviceFlowResponse }
  | { step: "error"; message: string }

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  )
}

export default function LoginPage() {
  const [state, setState] = useState<LoginState>({ step: "idle" })
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanup
  }, [cleanup])

  const startLogin = async () => {
    setState({ step: "loading" })
    try {
      const flow = await invoke<DeviceFlowResponse>("start_login")
      setState({ step: "device_code", flow })
      startPolling(flow)
    } catch (err) {
      setState({
        step: "error",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const startPolling = (flow: DeviceFlowResponse) => {
    cleanup()
    const interval = Math.max(flow.interval, 5) * 1000
    pollRef.current = setInterval(async () => {
      try {
        const result = await invoke<DeviceFlowPollResult>("poll_login", {
          deviceCode: flow.device_code,
        })
        if (result.status === "complete" && result.token) {
          cleanup()
          try {
            await invoke<GitHubUser>("get_current_user", {
              token: result.token,
            })
            window.location.href = "/"
          } catch (userErr) {
            setState({
              step: "error",
              message:
                userErr instanceof Error ? userErr.message : String(userErr),
            })
          }
        } else if (result.status === "expired") {
          cleanup()
          setState({ step: "error", message: "Authorization expired. Please try again." })
        } else if (result.status === "error") {
          cleanup()
          setState({
            step: "error",
            message: result.error || "An error occurred during authorization.",
          })
        }
      } catch (err) {
        cleanup()
        setState({
          step: "error",
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }, interval)
  }

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const cancel = () => {
    cleanup()
    setState({ step: "idle" })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Skill Builder</CardTitle>
          <CardDescription>
            {state.step === "device_code"
              ? "Enter this code on GitHub"
              : "Sign in with GitHub to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {state.step === "idle" && (
            <Button className="w-full" size="lg" onClick={startLogin}>
              <GitHubIcon className="size-5" />
              Sign in with GitHub
            </Button>
          )}

          {state.step === "loading" && (
            <Button className="w-full" size="lg" disabled>
              <Loader2 className="size-5 animate-spin" />
              Connecting...
            </Button>
          )}

          {state.step === "device_code" && (
            <>
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => copyCode(state.flow.user_code)}
                  className="group relative w-full cursor-pointer rounded-lg bg-muted px-6 py-4 text-center transition-colors hover:bg-muted/80"
                >
                  <span className="font-mono text-2xl font-bold tracking-[0.3em]">
                    {state.flow.user_code}
                  </span>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {copied ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </span>
                </button>
                <p className="text-xs text-muted-foreground">
                  Click to copy code
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => openUrl(state.flow.verification_uri)}
              >
                <ExternalLink className="size-4" />
                Open GitHub
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Waiting for authorization...
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mx-auto"
                onClick={cancel}
              >
                Cancel
              </Button>
            </>
          )}

          {state.step === "error" && (
            <>
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-center text-sm text-destructive">
                {state.message}
              </div>
              <Button className="w-full" size="lg" onClick={startLogin}>
                Try Again
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
