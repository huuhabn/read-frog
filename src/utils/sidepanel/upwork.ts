import type { ProviderConfig } from "@/types/config/provider"
import type { UpworkConfig } from "@/types/config/upwork"
import { browser } from "#imports"
import { MICROSOFT_TRANSLATE_PROVIDER_ID } from "@/utils/constants/providers"
import { createLogger } from "@/utils/logging/logger"
import { getTranslatePrompt } from "@/utils/prompts/translate"
import { doesProviderSupportsCapability } from "@/utils/providers/provider-registry"

const log = createLogger("upwork")

export const UPWORK_QUICK_PROMPT_COVER_LETTER =
  "Viết Upwork Cover Letter & Trả lời Screening Questions"
export const UPWORK_QUICK_PROMPT_ANALYZE_JOB = "Phân tích yêu cầu & rủi ro của job Upwork này"

export type UpworkTranslateLangKey =
  | "options.upwork.translateLangs.en"
  | "options.upwork.translateLangs.original"
  | "options.upwork.translateLangs.vi"
  | "options.upwork.translateLangs.zhCN"
  | "options.upwork.translateLangs.ja"
  | "options.upwork.translateLangs.ko"
  | "options.upwork.translateLangs.fr"
  | "options.upwork.translateLangs.de"
  | "options.upwork.translateLangs.es"
  | "options.upwork.translateLangs.ru"

export interface UpworkTranslateLangOption {
  code: string
  labelKey: UpworkTranslateLangKey
  name: string
}

export const UPWORK_TRANSLATE_LANGUAGES: UpworkTranslateLangOption[] = [
  { code: "en", labelKey: "options.upwork.translateLangs.en", name: "Tiếng Anh (English)" },
  {
    code: "original",
    labelKey: "options.upwork.translateLangs.original",
    name: "Không dịch (Original)",
  },
  { code: "vi", labelKey: "options.upwork.translateLangs.vi", name: "Tiếng Việt" },
  { code: "zh-CN", labelKey: "options.upwork.translateLangs.zhCN", name: "Tiếng Trung (Giản thể)" },
  { code: "ja", labelKey: "options.upwork.translateLangs.ja", name: "Tiếng Nhật (日本語)" },
  { code: "ko", labelKey: "options.upwork.translateLangs.ko", name: "Tiếng Hàn (한국어)" },
  { code: "fr", labelKey: "options.upwork.translateLangs.fr", name: "Tiếng Pháp (Français)" },
  { code: "de", labelKey: "options.upwork.translateLangs.de", name: "Tiếng Đức (Deutsch)" },
  { code: "es", labelKey: "options.upwork.translateLangs.es", name: "Tiếng Tây Ban Nha (Español)" },
  { code: "ru", labelKey: "options.upwork.translateLangs.ru", name: "Tiếng Nga (Русский)" },
]

/**
 * Translates text into target language using configured translation provider.
 */
export async function translateTextWithProvider(
  text: string,
  targetLang: string,
  providerId: string | undefined,
  providersConfig: ProviderConfig[],
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed || !targetLang || targetLang === "original") {
    return text
  }

  // Find specified provider, or fallback to first enabled translation provider, or microsoft
  let provider = providersConfig.find((p) => p.id === providerId && p.enabled)
  if (!provider) {
    provider = providersConfig.find(
      (p) =>
        p.enabled &&
        doesProviderSupportsCapability("pageTranslation", providersConfig, p.id, {
          requireEnable: true,
        }),
    )
  }
  if (!provider) {
    provider =
      providersConfig.find((p) => p.id === MICROSOFT_TRANSLATE_PROVIDER_ID) || providersConfig[0]
  }

  if (!provider) {
    return text
  }

  try {
    const langConfig = {
      sourceCode: "auto" as const,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      targetCode: targetLang as any,
      level: "advanced" as const,
    }
    const { executeTranslate } = await import("@/utils/host/translate/execute-translate")
    const res = await executeTranslate(text, langConfig, provider, getTranslatePrompt, {
      preserveLineBreaks: true,
    })
    return res || text
  } catch (error) {
    log.warn("Translation failed, using original text", { error })
    return text
  }
}

/**
 * Checks if a given URL is an Upwork job detail or application page.
 */
export function isUpworkJobDetailUrl(url?: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    if (!host.endsWith("upwork.com")) return false

    const pathname = parsed.pathname.toLowerCase()
    return (
      pathname.includes("/jobs/") ||
      pathname.includes("/job/") ||
      pathname.includes("/freelance-jobs/apply/") ||
      pathname.includes("/proposals/job/") ||
      pathname.includes("/proposals/new")
    )
  } catch {
    return false
  }
}

export interface UpworkExtractedJob {
  title?: string
  description?: string
  screeningQuestions?: string[]
}

/**
 * Extracts job description and screening questions from the active tab.
 */
export async function extractUpworkJobData(
  tabId: number,
  selectors: {
    jobDetailsSelector: string
    screeningQuestionsSelector: string
  },
): Promise<UpworkExtractedJob> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: (jobSel: string, screeningSel: string) => {
        let desc = ""
        if (jobSel) {
          const descEl = document.querySelector(jobSel)
          if (descEl) {
            desc = (descEl as HTMLElement).innerText || descEl.textContent || ""
          }
        }

        const screening: string[] = []
        if (screeningSel) {
          const els = document.querySelectorAll(screeningSel)
          els.forEach((el) => {
            const text = ((el as HTMLElement).innerText || el.textContent || "").trim()
            if (text && !screening.includes(text)) {
              screening.push(text)
            }
          })
        }

        const pageTitle = document.title || ""
        return {
          title: pageTitle,
          description: desc.trim(),
          screeningQuestions: screening,
        }
      },
      args: [selectors.jobDetailsSelector, selectors.screeningQuestionsSelector],
    })

    return results?.[0]?.result ?? {}
  } catch (error) {
    log.warn("Failed to extract job data from tab", { error })
    return {}
  }
}

/**
 * Builds the prompt and system prompt for the Upwork Cover Letter.
 */
export function buildUpworkCoverLetterPrompt(
  config: UpworkConfig,
  job: {
    title?: string
    url?: string
    description?: string
    screeningQuestions?: string[]
    pageTextFallback?: string
  },
): { userPrompt: string; systemPrompt: string } {
  const profileFacts =
    config.profile.trim() ||
    "(Chưa có thông tin Profile trong Settings. Hãy viết Cover Letter dựa trên các kỹ năng phổ biến liên quan đến yêu cầu công việc.)"
  const tone = config.tone || "professional"
  const wordCount = config.wordCount || 200
  const rules = config.rules?.trim() || ""
  const examples = config.examples?.trim() || ""
  const targetLang = config.translateLang || "en"
  const langInstruction =
    targetLang && targetLang !== "original"
      ? `\n6. Ngôn ngữ phản hồi: Toàn bộ Cover Letter và câu trả lời screening BẮT BUỘC PHẢI ĐƯỢC VIẾT BẰNG NGÔN NGỮ: ${targetLang.toUpperCase()}.`
      : ""

  const systemPrompt = `Bạn là trợ lý AI chuyên nghiệp hỗ trợ Freelancer viết Upwork Cover Letter / Proposal và trả lời câu hỏi sàng lọc (Screening Questions).

NGUYÊN TẮC BẮT BUỘC (QUAN TRỌNG NHẤT):
1. CHỈ ĐƯỢC PHÉP DÙNG FACTS CÓ TRONG HỒ SƠ (PROFILE FACTS) DƯỚI ĐÂY. Tuyệt đối KHÔNG BỊA ĐẶT kinh nghiệm, kỹ năng, số năm làm việc, hoặc dự án không có trong hồ sơ.
2. Trả lời đầy đủ, trực tiếp và cụ thể từng câu hỏi sàng lọc (Screening Questions) nếu bài đăng có câu hỏi.
3. Độ dài Cover Letter: khoảng ${wordCount} từ.
4. Giọng điệu (Tone): ${tone}.${langInstruction}
${rules ? `5. Các quy tắc bắt buộc:\n${rules}\n` : ""}
${examples ? `\nVÍ DỤ COVER LETTER MẪU THAM KHẢO:\n${examples}\n` : ""}
HỒ SƠ FREELANCER (PROFILE FACTS):
${profileFacts}

HƯỚNG DẪN TRÌNH BÀY:
- Phần 1: COVER LETTER (Bắt đầu trực tiếp, giải quyết vấn đề của khách hàng, nêu kinh nghiệm có thực trong profile).
- Phần 2 (nếu có câu hỏi sàng lọc): Đặt tiêu đề rõ ràng "SCREENING QUESTIONS & ANSWERS:" và đánh số trả lời từng câu hỏi.`

  const jobDesc = job.description || job.pageTextFallback || "Xem nội dung công việc trên trang."
  const screeningSection =
    job.screeningQuestions && job.screeningQuestions.length > 0
      ? `\n\nCÂU HỎI SÀNG LỌC (SCREENING QUESTIONS):\n${job.screeningQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : ""

  const userPrompt = `Hãy viết một Cover Letter ứng tuyển công việc Upwork sau đây theo đúng hồ sơ và quy tắc của tôi:

TIÊU ĐỀ: ${job.title || "Chi tiết công việc Upwork"}
${job.url ? `URL: ${job.url}\n` : ""}
MÔ TẢ CÔNG VIỆC:
${jobDesc}${screeningSection}`

  return { userPrompt, systemPrompt }
}

/**
 * Fills the cover letter text into the Upwork proposal form textarea.
 */
export async function fillUpworkCoverLetter(
  tabId: number,
  selector: string,
  content: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // Extract cover letter part (remove screening Q&A if present)
    let coverLetterText = content
    const match = content.split(
      /(?:SCREENING QUESTIONS & ANSWERS|CÂU HỎI SÀNG LỌC|Screening Q&A):/i,
    )
    if (match.length > 1 && match[0]?.trim()) {
      coverLetterText = match[0].trim()
    }

    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: (inputSelector: string, textToFill: string) => {
        let textarea = document.querySelector<HTMLTextAreaElement>(inputSelector)

        // Fallbacks if specified selector didn't find textarea
        if (!textarea) {
          const fallbacks = [
            'textarea[data-test="cover-letter-text"]',
            "textarea#coverLetter",
            'textarea[aria-label*="cover letter" i]',
            'textarea[placeholder*="cover letter" i]',
            "textarea",
          ]
          for (const fb of fallbacks) {
            const found = document.querySelector<HTMLTextAreaElement>(fb)
            if (found && found.offsetParent !== null) {
              textarea = found
              break
            }
          }
        }

        if (!textarea) {
          return { success: false, reason: "NOT_FOUND" }
        }

        // Support React/controlled input via native value setter
        const proto = window.HTMLTextAreaElement.prototype
        const descriptor = Object.getOwnPropertyDescriptor(proto, "value")
        if (descriptor && typeof descriptor.set === "function") {
          // oxlint-disable-next-line typescript/unbound-method -- native setter is intentionally bound with Reflect.apply
          Reflect.apply(descriptor.set, textarea, [textToFill])
        } else {
          textarea.value = textToFill
        }

        textarea.dispatchEvent(new Event("input", { bubbles: true }))
        textarea.dispatchEvent(new Event("change", { bubbles: true }))
        textarea.focus()

        return { success: true }
      },
      args: [selector, coverLetterText],
    })

    const res = results?.[0]?.result
    if (res?.success) {
      return { success: true, message: "Đã tự động điền Cover Letter vào form Upwork!" }
    }

    return {
      success: false,
      message:
        "Không tìm thấy ô nhập Cover Letter trên trang hiện tại. Vui lòng mở trang Submit Proposal.",
    }
  } catch (error) {
    log.warn("Failed to fill cover letter into tab", { error })
    return {
      success: false,
      message: "Không thể điền vào trang web. Vui lòng sao chép thủ công.",
    }
  }
}
