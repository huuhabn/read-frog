import { useTheme } from "@/components/providers/theme-provider"
import { Switch } from "@/components/ui/base-ui/switch"
import { THEMES } from "@/types/config/theme"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { ThemeModeSelect } from "./theme-mode-select"
import { UiLanguageSelect } from "./ui-language-select"

export function AppearanceAndLanguageSection() {
  const { themeName, scaled, setScaled } = useTheme()
  return (
    <ConfigSection title={i18n.t("options.preference.appearanceAndLanguage.title")}>
      <ConfigItem
        id="theme-name"
        title={i18n.t("options.preference.appearanceAndLanguage.theme.title")}
        description={i18n.t("options.preference.appearanceAndLanguage.theme.description")}
      >
        <span className="text-sm font-medium">{THEMES[themeName].name}</span>
      </ConfigItem>
      <ConfigItem
        id="theme-mode"
        title={i18n.t("options.preference.appearanceAndLanguage.theme.modeTitle")}
        description={i18n.t("options.preference.appearanceAndLanguage.theme.modeDescription")}
      >
        <ThemeModeSelect size="sm" />
      </ConfigItem>
      <ConfigItem
        id="theme-scaled"
        title={i18n.t("options.preference.appearanceAndLanguage.theme.scaledTitle")}
        description={i18n.t("options.preference.appearanceAndLanguage.theme.scaledDescription")}
      >
        <Switch checked={scaled} onCheckedChange={(checked) => void setScaled(checked)} size="sm" />
      </ConfigItem>
      <ConfigItem
        id="interface-language"
        title={i18n.t("options.preference.appearanceAndLanguage.interfaceLanguage.title")}
        description={i18n.t(
          "options.preference.appearanceAndLanguage.interfaceLanguage.description",
        )}
      >
        <UiLanguageSelect size="sm" />
      </ConfigItem>
    </ConfigSection>
  )
}
