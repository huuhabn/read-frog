import type { NavItemDef } from "./nav-items"
import { Icon } from "@iconify/react"
import { Link, useLocation } from "react-router"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/base-ui/sidebar"

export function NavItems({ items }: { items: readonly NavItemDef[] }) {
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map(({ path, icon, label: getLabel, isActive }) => {
        const label = getLabel()
        return (
          <SidebarMenuItem key={path}>
            <SidebarMenuButton
              render={<Link to={path} />}
              isActive={isActive ? isActive(pathname) : pathname === path}
              tooltip={label}
            >
              <Icon icon={icon} />
              <span>{label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      })}
    </SidebarMenu>
  )
}
