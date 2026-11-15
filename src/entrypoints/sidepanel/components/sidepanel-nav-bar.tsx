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
import { TooltipButton } from "@/components/tooltip-button"
import { TooltipProvider } from "@/components/ui/base-ui/tooltip"
import { sidepanelNavTabAtom } from "@/utils/atoms/sidepanel"
import { i18n } from "@/utils/i18n"
import { openOptionsPage } from "@/utils/navigation"
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
        <button
          type="button"
          onClick={handleOpenSettings}
          aria-label={i18n.t("sidePanel.nav.settings")}
          className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-primary/10 p-0.5 shadow-xs transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          <img src={logo} alt="" className="size-5.5 rounded-md object-contain" />
        </button>

        <TooltipProvider delay={150}>
          <nav className="flex flex-col items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <TooltipButton
                  key={item.id}
                  label={i18n.t(item.labelKey)}
                  active={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                >
                  <Icon className="size-4" />
                </TooltipButton>
              )
            })}
          </nav>
        </TooltipProvider>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <TooltipProvider delay={150}>
          <TooltipButton
            label={i18n.t("sidePanel.nav.logs")}
            size="md"
            onClick={handleOpenAuditLogs}
          >
            <ScrollText className="size-4" />
          </TooltipButton>

          <TooltipButton
            label={i18n.t("sidePanel.nav.settings")}
            size="md"
            onClick={handleOpenSettings}
          >
            <Settings className="size-4" />
          </TooltipButton>
        </TooltipProvider>
      </div>
    </aside>
  )
}
