import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"
import { NavItems } from "./nav-item-list"
import { SETTINGS_NAV_ITEMS } from "./nav-items"

export function SettingsNav() {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.settings")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <NavItems items={SETTINGS_NAV_ITEMS} />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
