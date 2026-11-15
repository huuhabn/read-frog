import { SidebarGroup, SidebarGroupContent } from "@/components/ui/base-ui/sidebar"
import { NavItems } from "./nav-item-list"
import { PRIMARY_NAV_ITEMS } from "./nav-items"

export function PrimaryNav() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <NavItems items={PRIMARY_NAV_ITEMS} />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
