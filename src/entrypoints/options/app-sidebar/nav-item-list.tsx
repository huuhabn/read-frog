import type { NavItemDef } from "./nav-items"
import { Icon } from "@iconify/react"
import { Link, useLocation } from "react-router"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/base-ui/sidebar"

export function NavItems({ items }: { items: readonly NavItemDef[] }) {
  const { pathname } = useLocation()

  return (
    <SidebarMenu>
      {items.map((item) => {
        const label = item.label()
        if (item.kind === "external") {
          return (
            <SidebarMenuItem key={item.href()}>
              <SidebarMenuButton
                render={<a href={item.href()} target="_blank" rel="noopener noreferrer" />}
                tooltip={label}
              >
                <Icon icon={item.icon} />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        }

        const { path, icon, isActive } = item
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
