import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { LanguagesSection } from "./languages"
import { SystemPromptSection } from "./system-prompt"
import { TriggerSection } from "./trigger"

export function InputTranslationPage() {
  return (
    <PageLayout
      title={i18n.t("options.inputTranslation.title")}
      description={i18n.t("options.inputTranslation.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <TriggerSection />
      <LanguagesSection />
      <SystemPromptSection />
    </PageLayout>
  )
}
