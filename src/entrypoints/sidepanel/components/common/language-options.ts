export interface LanguageOption {
  code: string
  name: string
}

export const AUTO_DETECT_OPTION: LanguageOption = {
  code: "auto",
  name: "Auto Detect",
}

export const POPULAR_LANGUAGES: LanguageOption[] = [
  { code: "vi", name: "Tiếng Việt" },
  { code: "en", name: "English" },
  { code: "zh-CN", name: "中文 (Giản thể)" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "ru", name: "Русский" },
]
