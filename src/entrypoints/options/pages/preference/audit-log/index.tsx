import { Icon } from "@iconify/react"
import { useAtom } from "jotai"
import { Link } from "react-router"
import { Button } from "@/components/ui/base-ui/button"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"

export function AuditLogSection() {
  const [auditLog, setAuditLog] = useAtom(configFieldsAtomMap.auditLog)

  return (
    <ConfigSection title={i18n.t("options.preference.auditLog.sectionTitle")}>
      <ConfigItem
        id="audit-log-enabled"
        title={i18n.t("options.preference.auditLog.enabled.title")}
        description={i18n.t("options.preference.auditLog.enabled.description")}
      >
        <Switch
          checked={auditLog.enabled}
          onCheckedChange={(checked) => {
            void setAuditLog({ enabled: checked })
          }}
        />
      </ConfigItem>

      <ConfigItem
        id="audit-log-retention"
        title={i18n.t("options.preference.auditLog.retention.title")}
        description={i18n.t("options.preference.auditLog.retention.description")}
      >
        <div className="flex items-center gap-2">
          <select
            value={auditLog.retentionDays}
            onChange={(e) => {
              void setAuditLog({ retentionDays: Number(e.target.value) })
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-hidden"
          >
            <option value={7}>7 {i18n.t("options.preference.auditLog.days")}</option>
            <option value={14}>14 {i18n.t("options.preference.auditLog.days")}</option>
            <option value={30}>30 {i18n.t("options.preference.auditLog.days")}</option>
            <option value={60}>60 {i18n.t("options.preference.auditLog.days")}</option>
            <option value={90}>90 {i18n.t("options.preference.auditLog.days")}</option>
          </select>
        </div>
      </ConfigItem>

      <ConfigItem
        id="audit-log-view"
        title={i18n.t("options.preference.auditLog.manage.title")}
        description={i18n.t("options.preference.auditLog.manage.description")}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link to="/advanced/audit-logs" />}
          className="gap-1.5"
        >
          <Icon icon="tabler:external-link" className="size-4" />
          <span>{i18n.t("options.preference.auditLog.manage.button")}</span>
        </Button>
      </ConfigItem>
    </ConfigSection>
  )
}
