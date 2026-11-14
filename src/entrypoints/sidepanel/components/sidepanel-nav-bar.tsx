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
  labelKey:
    | "sidePanel.nav.chat"
    | "sidePanel.nav.webChat"
    | "sidePanel.nav.read"
    | "sidePanel.nav.write"
    | "sidePanel.nav.translate"
    | "sidePanel.nav.history"
  icon: typeof MessageSquare
}

const NAV_ITEMS: NavItem[] = [
  { id: "chat", labelKey: "sidePanel.nav.chat", icon: MessageSquare },
  { id: "web-chat", labelKey: "sidePanel.nav.webChat", icon: BotMessageSquare },
  { id: "read", labelKey: "sidePanel.nav.read", icon: BookOpen },
  { id: "write", labelKey: "sidePanel.nav.write", icon: PenTool },
  { id: "translate", labelKey: "sidePanel.nav.translate", icon: Languages },
  { id: "history", labelKey: "sidePanel.nav.history", icon: History },
]

export function SidePanelNavBar() {
  const [activeTab, setActiveTab] = useAtom(sidepanelNavTabAtom)

  const handleOpenSettings = () => {
    void openOptionsPage({ route: "/providers" })
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
                    {i18n.t(item.labelKey)}
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
              {i18n.t("sidePanel.nav.logs")}
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
              {i18n.t("sidePanel.nav.settings")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  )
}
