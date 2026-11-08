import type { FloatingButtonSide } from "@/types/config/floating-button"
import { IconLayoutSidebar } from "@tabler/icons-react"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import HiddenButton from "./components/hidden-button"

export default function SidePanelButton({
  className,
  side = "right",
  expanded = false,
}: {
  className?: string
  side?: FloatingButtonSide
  expanded?: boolean
}) {
  const label = i18n.t("options.floatingButton.tooltips.sidePanel") || "AI Side Panel"

  return (
    <HiddenButton
      icon={<IconLayoutSidebar className="h-5 w-5 text-primary" />}
      label={label}
      className={className}
      side={side}
      expanded={expanded}
      onClick={() => {
        void sendMessage("toggleSidePanel", undefined)
      }}
    />
  )
}
