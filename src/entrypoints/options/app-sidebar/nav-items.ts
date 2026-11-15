import { browser } from "#imports"
import { env } from "@/env"
import { TRANSLATION_HUB_PAGE_PATH } from "@/utils/constants/translation-hub"
import { i18n } from "@/utils/i18n"

export const ROUTE_DEFS = [
  { path: "/" },
  { path: "/general" },
  { path: "/shortcuts" },
  { path: "/providers" },
  { path: "/custom-actions" },
  { path: "/page-translation" },
  { path: "/video-subtitles" },
  { path: "/floating-button" },
  { path: "/selection-toolbar" },
  { path: "/context-menu" },
  { path: "/input-translation" },
  { path: "/tts" },
  { path: "/upwork" },
  { path: "/web-chat" },
  // Advanced is a sidebar GROUP with no page of its own; this path only exists
  // so links made before that change still land somewhere.
  { path: "/advanced" },
  { path: "/help-and-community" },

  // Detail pages drilled into from a `ConfigNavItem`. They own no sidebar entry — the
  // sidebar lists its links itself — but route exactly like any other page.
  { path: "/advanced/glossary" },
  { path: "/advanced/glossary/:glossaryId" },
  { path: "/advanced/audit-logs" },
  { path: "/general/config-backup" },
  { path: "/general/extension-activation" },
  { path: "/page-translation/custom-css" },
  { path: "/page-translation/prompts" },
  { path: "/page-translation/translation-control" },
  { path: "/page-translation/translation-control/auto-translate-websites" },
  { path: "/page-translation/translation-control/never-auto-translate-websites" },
  { path: "/page-translation/translation-control/site-rules" },
  { path: "/page-translation/translation-queue" },
  { path: "/video-subtitles/auto-start" },
  { path: "/video-subtitles/style" },
  { path: "/video-subtitles/style/custom-css" },
  { path: "/video-subtitles/prompts" },
  { path: "/video-subtitles/subtitles-queue" },
] as const

export type RoutePath = (typeof ROUTE_DEFS)[number]["path"]

type Label = () => string // gọi lúc render, để i18n.t và chuỗi literal ("Upwork") dùng chung được

export type SubNavItem =
  | { kind: "link"; path: RoutePath; label: Label; isActive?: (pathname: string) => boolean }
  | { kind: "external"; href: () => string; label: Label; badge?: "new" }

export type FeatureNavItem =
  | { kind: "link"; path: RoutePath; icon: string; label: Label }
  | { kind: "external"; href: () => string; icon: string; label: Label }
  | { kind: "group"; icon: string; label: Label; children: readonly SubNavItem[] }

export const FEATURE_NAV_ITEMS: readonly FeatureNavItem[] = [
  {
    kind: "link",
    path: "/custom-actions",
    icon: "tabler:sparkles",
    label: () => i18n.t("options.selectionToolbar.customActions.title"),
  },
  {
    kind: "group",
    icon: "ri:translate",
    label: () => i18n.t("options.sidebar.translation"),
    children: [
      {
        kind: "link",
        path: "/page-translation",
        label: () => i18n.t("options.translation.title"),
        isActive: (p) => p.startsWith("/page-translation"),
      },
      {
        kind: "link",
        path: "/video-subtitles",
        label: () => i18n.t("options.videoSubtitles.title"),
        isActive: (p) => p.startsWith("/video-subtitles"),
      },
      {
        kind: "link",
        path: "/input-translation",
        label: () => i18n.t("options.inputTranslation.title"),
      },
      {
        kind: "external",
        href: () => `${env.WXT_WEBSITE_URL}/pdf-translation`,
        label: () => i18n.t("options.tools.pdfTranslation"),
        badge: "new",
      },
    ],
  },
  {
    kind: "group",
    icon: "tabler:layers-intersect",
    label: () => i18n.t("options.overlayTools.title"),
    children: [
      {
        kind: "link",
        path: "/floating-button",
        label: () => i18n.t("options.floatingButton.title"),
      },
      {
        kind: "link",
        path: "/selection-toolbar",
        label: () => i18n.t("options.selectionToolbar.title"),
      },
      { kind: "link", path: "/context-menu", label: () => i18n.t("options.contextMenu.title") },
    ],
  },
  {
    kind: "link",
    path: "/tts",
    icon: "tabler:speakerphone",
    label: () => i18n.t("options.tts.title"),
  },
  { kind: "link", path: "/upwork", icon: "tabler:briefcase", label: () => "Upwork" },
  {
    kind: "link",
    path: "/web-chat",
    icon: "tabler:messages",
    label: () => i18n.t("options.webChat.title"),
  },
  {
    kind: "external",
    icon: "tabler:language-hiragana",
    href: () => browser.runtime.getURL(TRANSLATION_HUB_PAGE_PATH),
    label: () => i18n.t("options.tools.translationHub"),
  },
  {
    kind: "group",
    icon: "tabler:flask",
    label: () => i18n.t("options.advanced.title"),
    children: [
      {
        kind: "link",
        path: "/advanced/glossary",
        label: () => i18n.t("options.advanced.glossary.title"),
        isActive: (p) => p.startsWith("/advanced/glossary"),
      },
      {
        kind: "link",
        path: "/advanced/audit-logs",
        label: () => i18n.t("options.advanced.auditLogs.title"),
        isActive: (p) => p.startsWith("/advanced/audit-logs"),
      },
    ],
  },
]

export interface NavItemDef {
  path: RoutePath
  icon: string
  label: Label
  isActive?: (pathname: string) => boolean
}

export const SETTINGS_NAV_ITEMS: readonly NavItemDef[] = [
  {
    path: "/providers",
    icon: "tabler:api",
    label: () => i18n.t("options.apiProviders.title"),
    isActive: (p) => p === "/providers" || p === "/",
  },
  {
    path: "/general",
    icon: "tabler:adjustments-horizontal",
    label: () => i18n.t("options.preference.title"),
    isActive: (p) => p.startsWith("/general"),
  },
  {
    path: "/shortcuts",
    icon: "tabler:command",
    label: () => i18n.t("options.shortcuts.title"),
  },
]
