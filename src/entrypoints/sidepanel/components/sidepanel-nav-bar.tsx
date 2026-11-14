import type { SidePanelNavTab } from "@/utils/atoms/sidepanel"
import { useAtom } from "jotai"
import {
  BookOpen,
  BotMessageSquare,
  History,
  Languages,
  MessageSquare,
  PenTool,
  ScrollText,
  Settings,
} from "lucide-react"
import logo from "@/assets/icons/logo.png?url&no-inline"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/base-ui/tooltip"
import { sidepanelNavTabAtom } from "@/utils/atoms/sidepanel"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"
import { cn } from "@/utils/styles/utils"

interface NavItem {
  id: SidePanelNavTab
  label: string
  icon: typeof MessageSquare
}

const NAV_ITEMS: NavItem[] = [
  { id: "chat", label: "Chat AI", icon: MessageSquare },
  { id: "web-chat", label: "Web Chat Assistant", icon: BotMessageSquare },
  { id: "read", label: "Read & Summarize", icon: BookOpen },
  { id: "write", label: "Write & Compose", icon: PenTool },
  { id: "translate", label: "Translate", icon: Languages },
  { id: "history", label: "Chat History", icon: History },
]

export function SidePanelNavBar() {
  const [activeTab, setActiveTab] = useAtom(sidepanelNavTabAtom)

  const handleOpenSettings = () => {
    void openOptionsPage({ route: "/api-providers" })
  }

  const handleOpenAuditLogs = () => {
    void openOptionsPage({ route: "/advanced/audit-logs" })
  }

  return (
    <aside className="flex h-screen w-10 flex-col items-center justify-between border-l border-border/60 bg-muted/20 py-2.5 select-none">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 p-0.5 shadow-xs">
          <img src={logo} alt="Workmate AI" className="size-5.5 rounded-md object-contain" />
        </div>

        <TooltipProvider delay={150}>
          <nav className="flex flex-col items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
                      isActive &&
                        "bg-primary/15 font-medium text-primary shadow-xs ring-1 ring-primary/20",
                    )}
                  >
                    <Icon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={6} className="text-xs font-medium">
                    {item.id === "web-chat"
                      ? i18n.t("options.webChat.sidepanel.tabLabel")
                      : item.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
        </TooltipProvider>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <TooltipProvider delay={150}>
          <Tooltip>
            <TooltipTrigger
              onClick={handleOpenAuditLogs}
              className="flex size-7.5 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ScrollText className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6} className="text-xs font-medium">
              Request Audit Logs
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              onClick={handleOpenSettings}
              className="flex size-7.5 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Settings className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={6} className="text-xs font-medium">
              Settings & Providers
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}
