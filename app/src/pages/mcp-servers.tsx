import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Plus, Pencil, X, Server, Globe } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import type { McpServerConfig, AppSettings } from "@/lib/types"
import { useSettingsStore } from "@/stores/settings-store"

export default function McpServersPage() {
  const { mcpServers, addMcpServer, updateMcpServer, removeMcpServer } =
    useSettingsStore()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [type, setType] = useState<"http" | "sse">("http")
  const [url, setUrl] = useState("")
  const [authHeader, setAuthHeader] = useState("")

  const saveMcpServers = async (servers: McpServerConfig[]) => {
    const store = useSettingsStore.getState()
    const settings: AppSettings = {
      anthropic_api_key: store.anthropicApiKey,
      workspace_path: store.workspacePath,
      skills_path: store.skillsPath,
      preferred_model: store.preferredModel,
      debug_mode: store.debugMode,
      log_level: store.logLevel,
      extended_context: store.extendedContext,
      extended_thinking: store.extendedThinking,
      splash_shown: false,
      github_oauth_token: store.githubOauthToken ?? null,
      github_user_login: store.githubUserLogin ?? null,
      github_user_avatar: store.githubUserAvatar ?? null,
      github_user_email: store.githubUserEmail ?? null,
      mcp_servers: servers,
    }
    try {
      await invoke("save_settings", { settings })
    } catch (err) {
      toast.error(`Failed to save: ${err}`, { duration: Infinity })
    }
  }

  const resetForm = () => {
    setName("")
    setType("http")
    setUrl("")
    setAuthHeader("")
    setEditingServer(null)
  }

  const handleAdd = () => {
    resetForm()
    setDialogOpen(true)
  }

  const handlePreset = (preset: "linear" | "notion") => {
    resetForm()
    if (preset === "linear") {
      setName("linear")
      setType("http")
      setUrl("https://mcp.linear.app/mcp")
    } else if (preset === "notion") {
      setName("notion")
      setType("http")
      setUrl("https://mcp.notion.com/mcp")
    }
    setDialogOpen(true)
  }

  const handleEdit = (server: McpServerConfig) => {
    setEditingServer(server.name)
    setName(server.name)
    setType(server.type)
    setUrl(server.url)
    setAuthHeader(server.headers?.Authorization ?? "")
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!name.trim() || !url.trim()) {
      toast.error("Name and URL are required")
      return
    }

    const headers: Record<string, string> = {}
    if (authHeader.trim()) {
      headers.Authorization = authHeader.trim()
    }

    const server: McpServerConfig = {
      name: name.trim(),
      type,
      url: url.trim(),
      headers,
    }

    let nextServers: McpServerConfig[]
    if (editingServer) {
      updateMcpServer(editingServer, server)
      nextServers = useSettingsStore
        .getState()
        .mcpServers.map((s) => (s.name === editingServer ? server : s))
      toast.success(`Updated "${server.name}"`, { duration: 1500 })
    } else {
      // Check for duplicate name
      if (mcpServers.some((s) => s.name === server.name)) {
        toast.error(`Server "${server.name}" already exists`)
        return
      }
      addMcpServer(server)
      nextServers = [...useSettingsStore.getState().mcpServers]
      toast.success(`Added "${server.name}"`, { duration: 1500 })
    }

    saveMcpServers(nextServers)
    setDialogOpen(false)
    resetForm()
  }

  const handleRemove = (serverName: string) => {
    removeMcpServer(serverName)
    const nextServers = useSettingsStore
      .getState()
      .mcpServers.filter((s) => s.name !== serverName)
    saveMcpServers(nextServers)
    toast.success(`Removed "${serverName}"`, { duration: 1500 })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">MCP Servers</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePreset("linear")}>
            Linear
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePreset("notion")}>
            Notion
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="size-4" />
            Add Server
          </Button>
        </div>
      </div>

      {mcpServers.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Globe className="size-6 text-muted-foreground" />
            </div>
            <CardTitle>No MCP servers configured</CardTitle>
            <CardDescription>
              Connect external data sources like Notion and Linear so agents can
              reference them during skill building.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={handleAdd}>
              <Plus className="size-4" />
              Add Server
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mcpServers.map((server) => (
            <Card key={server.name}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">{server.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleEdit(server)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemove(server.name)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground truncate">
                  {server.url}
                </p>
                <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {server.type.toUpperCase()}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingServer ? "Edit MCP Server" : "Add MCP Server"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Name</Label>
              <Input
                id="server-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. linear"
                disabled={!!editingServer}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-type">Transport</Label>
              <select
                id="server-type"
                value={type}
                onChange={(e) => setType(e.target.value as "http" | "sse")}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="http">HTTP (Streamable)</option>
                <option value="sse">SSE (Legacy)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-url">URL</Label>
              <Input
                id="server-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.example.com/mcp"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="server-auth">Authorization Header</Label>
              <Input
                id="server-auth"
                type="password"
                value={authHeader}
                onChange={(e) => setAuthHeader(e.target.value)}
                placeholder="Bearer token..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingServer ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
