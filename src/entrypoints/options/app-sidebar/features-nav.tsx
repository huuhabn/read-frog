import type { ReactNode } from "react"
import type { FeatureNavItem, SubNavItem } from "./nav-items"
import { Icon } from "@iconify/react"
import { useState } from "react"
import { Link, useLocation } from "react-router"
import { NewBadge } from "@/components/badges/new-badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/base-ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/base-ui/sidebar"
import { i18n } from "@/utils/i18n"
import { FEATURE_NAV_ITEMS } from "./nav-items"

const isSubActive = (item: SubNavItem, pathname: string) =>
  item.kind === "link" && (item.isActive ? item.isActive(pathname) : pathname === item.path)

const getFeatureNavKey = (item: FeatureNavItem) => {
  if (item.kind === "link") return item.path
  if (item.kind === "external") return item.href()
  return item.icon
}

function FeatureNavEntry({ item, pathname }: { item: FeatureNavItem; pathname: string }) {
  const label = item.label()

  if (item.kind === "link") {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          render={<Link to={item.path} />}
          isActive={pathname === item.path}
          tooltip={label}
        >
          <Icon icon={item.icon} />
          <span>{label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  if (item.kind === "external") {
    return (
      <SidebarMenuItem>
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

  const active = item.children.some((c) => isSubActive(c, pathname))
  return (
    <CollapsibleNavGroup active={active}>
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton isActive={active} tooltip={label} />}>
          <Icon icon={item.icon} />
          <span>{label}</span>
          <Icon
            icon="tabler:chevron-right"
            className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.children.map((child) => (
              <SidebarMenuSubItem key={child.kind === "link" ? child.path : child.href()}>
                {child.kind === "link" ? (
                  <SidebarMenuSubButton
                    render={<Link to={child.path} />}
                    isActive={isSubActive(child, pathname)}
                  >
                    <span>{child.label()}</span>
                  </SidebarMenuSubButton>
                ) : (
                  <SidebarMenuSubButton
                    render={<a href={child.href()} target="_blank" rel="noopener noreferrer" />}
                  >
                    <span className="truncate">{child.label()}</span>
                    {child.badge === "new" && <NewBadge size="sm" className="ml-auto" />}
                  </SidebarMenuSubButton>
                )}
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </CollapsibleNavGroup>
  )
}

export function FeaturesNav() {
  const { pathname } = useLocation()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{i18n.t("options.sidebar.features")}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {FEATURE_NAV_ITEMS.map((item) => (
            <FeatureNavEntry key={getFeatureNavKey(item)} item={item} pathname={pathname} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

/**
 * A feature group that opens whenever the route lands on one of its pages — from a link, the
 * command palette or a URL as much as from the sidebar — and otherwise opens and closes only by
 * hand. Base UI reads `defaultOpen` once, so a route-driven `defaultOpen` neither opened the
 * group nor stayed quiet about changing.
 */
function CollapsibleNavGroup({ active, children }: { active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(active)
  // Adjusted while rendering rather than in an effect, so the group opens with the page instead of
  // a frame later. Comparing booleans, one update settles it.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) setOpen(true)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      {children}
    </Collapsible>
  )
}
