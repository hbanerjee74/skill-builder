import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Loader2, Eye, EyeOff, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import type { AppSettings } from "@/lib/types"

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    anthropic_api_key: null,
    github_token: null,
    github_repo: null,
    workspace_path: null,
    auto_commit: false,
    auto_push: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await invoke<AppSettings>("get_settings")
        setSettings(result)
      } catch {
        // Settings may not exist yet — use defaults
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await invoke("save_settings", { settings })
      toast.success("Settings saved")
    } catch (err) {
      toast.error(
        `Failed to save settings: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTestApiKey = async () => {
    if (!settings.anthropic_api_key) {
      toast.error("Enter an API key first")
      return
    }
    setTesting(true)
    try {
      await invoke("test_api_key", { apiKey: settings.anthropic_api_key })
      toast.success("API key is valid")
    } catch (err) {
      toast.error(
        `Invalid API key: ${err instanceof Error ? err.message : String(err)}`
      )
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Configure your Anthropic API key for skill building.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="api-key">Anthropic API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  placeholder="sk-ant-..."
                  value={settings.anthropic_api_key || ""}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      anthropic_api_key: e.target.value || null,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestApiKey}
                disabled={testing || !settings.anthropic_api_key}
              >
                {testing && <Loader2 className="size-3.5 animate-spin" />}
                Test
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GitHub Repository</CardTitle>
          <CardDescription>
            Configure your GitHub repository for skill storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="repo">Repository</Label>
            <Input
              id="repo"
              placeholder="e.g., myuser/skill-repo"
              value={settings.github_repo || ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  github_repo: e.target.value || null,
                }))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-path">Workspace Path</Label>
            <Input
              id="workspace-path"
              placeholder="~/skill-builder-workspace/repo-name"
              value={settings.workspace_path || ""}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  workspace_path: e.target.value || null,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Local directory where skill files are stored
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label htmlFor="auto-commit">Auto-commit</Label>
              <p className="text-xs text-muted-foreground">
                Automatically commit after each workflow step
              </p>
            </div>
            <Switch
              id="auto-commit"
              checked={settings.auto_commit}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, auto_commit: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <Label htmlFor="auto-push">Auto-push</Label>
              <p className="text-xs text-muted-foreground">
                Push to GitHub after each commit
              </p>
            </div>
            <Switch
              id="auto-push"
              checked={settings.auto_push}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, auto_push: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
