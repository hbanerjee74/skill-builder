import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Settings, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/" as const, label: "Dashboard", icon: Home },
  { to: "/settings" as const, label: "Settings", icon: Settings },
];

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const { theme, setTheme } = useTheme();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-sidebar-background text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <span className="text-lg font-semibold">Skill Builder</span>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/" ? currentPath === "/" : currentPath.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <label className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            {theme === "dark" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            Dark mode
          </span>
          <Switch
            checked={theme === "dark"}
            onCheckedChange={(checked) =>
              setTheme(checked ? "dark" : "light")
            }
            size="sm"
          />
        </label>
      </div>
    </aside>
  );
}
