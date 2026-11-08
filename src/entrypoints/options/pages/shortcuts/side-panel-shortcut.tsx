import { useAtom } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ShortcutConfigItem } from "./shortcut-config-item"

export function SidePanelShortcut() {
  const [sidePanel, setSidePanel] = useAtom(configFieldsAtomMap.sidePanel)

  return (
    <ShortcutConfigItem
      id="side-panel-shortcut"
      title={i18n.t("options.shortcuts.sidePanel.title")}
      description={i18n.t("options.shortcuts.sidePanel.description")}
      shortcut={sidePanel.shortcut}
      onChange={(nextShortcut) => {
        void setSidePanel({ shortcut: nextShortcut })
      }}
    />
  )
}
