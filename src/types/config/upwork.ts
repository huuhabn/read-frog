import { z } from "zod"

export const DEFAULT_UPWORK_CONFIG = {
  enabled: true,
  profile: "",
  wordCount: 200,
  tone: "professional",
  rules:
    "- Chỉ sử dụng facts có trong profile, tuyệt đối không bịa đặt kinh nghiệm hoặc kỹ năng.\n- Trả lời đầy đủ và cụ thể tất cả câu hỏi screening nếu có.\n- Đi thẳng vào giải pháp và kinh nghiệm liên quan đến yêu cầu công việc.",
  examples: "",
  providerId: "",
  translateLang: "en",
  translateProviderId: "",
  jobDetailsSelector:
    '[data-test="Description"] .air3-truncation, .job-description, [data-test="job-description"]',
  screeningQuestionsSelector:
    '[data-test="qa-group"] .question-text, .screening-questions, [data-test="screening-questions"]',
  coverLetterInputSelector:
    'textarea[data-test="cover-letter-text"], textarea#coverLetter, textarea[aria-label*="Cover Letter" i]',
} as const

export const upworkConfigSchema = z
  .object({
    enabled: z.boolean().default(DEFAULT_UPWORK_CONFIG.enabled),
    profile: z.string().default(DEFAULT_UPWORK_CONFIG.profile),
    wordCount: z.number().int().min(30).max(2000).default(DEFAULT_UPWORK_CONFIG.wordCount),
    tone: z.string().default(DEFAULT_UPWORK_CONFIG.tone),
    rules: z.string().default(DEFAULT_UPWORK_CONFIG.rules),
    examples: z.string().default(DEFAULT_UPWORK_CONFIG.examples),
    providerId: z.string().default(DEFAULT_UPWORK_CONFIG.providerId),
    translateLang: z.string().default(DEFAULT_UPWORK_CONFIG.translateLang),
    translateProviderId: z.string().default(DEFAULT_UPWORK_CONFIG.translateProviderId),
    jobDetailsSelector: z.string().default(DEFAULT_UPWORK_CONFIG.jobDetailsSelector),
    screeningQuestionsSelector: z
      .string()
      .default(DEFAULT_UPWORK_CONFIG.screeningQuestionsSelector),
    coverLetterInputSelector: z.string().default(DEFAULT_UPWORK_CONFIG.coverLetterInputSelector),
  })
  .default(DEFAULT_UPWORK_CONFIG)

export type UpworkConfig = z.infer<typeof upworkConfigSchema>
