import { z } from "zod"

export const DEFAULT_WEB_CHAT_CONFIG = {
  enabled: true,
  providerId: "",
  // Translation
  translateEnabled: false,
  inboundTargetLang: "vi",
  outboundTargetLang: "en",
  contextMessageCount: 5,
  autoTranslateOutbound: false,
  // Slash Commands
  slashCommandsEnabled: true,
  slashTriggerChar: "/",
  // Platforms
  enableZalo: true,
  enableTelegram: true,
  enableSlack: true,
  enableGeneric: true,
  remoteConfigUrl:
    "https://raw.githubusercontent.com/huuha/workmate-rules/main/chat-selectors.json",
  // Privacy & PII
  piiMaskingEnabled: true,
  maskPhone: true,
  maskBankStk: true,
  maskCccd: true,
  maskEmail: true,
} as const

export const webChatConfigSchema = z
  .object({
    enabled: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.enabled),
    providerId: z.string().default(DEFAULT_WEB_CHAT_CONFIG.providerId),
    translateEnabled: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.translateEnabled),
    inboundTargetLang: z.string().default(DEFAULT_WEB_CHAT_CONFIG.inboundTargetLang),
    outboundTargetLang: z.string().default(DEFAULT_WEB_CHAT_CONFIG.outboundTargetLang),
    contextMessageCount: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(DEFAULT_WEB_CHAT_CONFIG.contextMessageCount),
    autoTranslateOutbound: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.autoTranslateOutbound),
    slashCommandsEnabled: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.slashCommandsEnabled),
    slashTriggerChar: z.string().default(DEFAULT_WEB_CHAT_CONFIG.slashTriggerChar),
    enableZalo: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.enableZalo),
    enableTelegram: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.enableTelegram),
    enableSlack: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.enableSlack),
    enableGeneric: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.enableGeneric),
    remoteConfigUrl: z.string().default(DEFAULT_WEB_CHAT_CONFIG.remoteConfigUrl),
    piiMaskingEnabled: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.piiMaskingEnabled),
    maskPhone: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.maskPhone),
    maskBankStk: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.maskBankStk),
    maskCccd: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.maskCccd),
    maskEmail: z.boolean().default(DEFAULT_WEB_CHAT_CONFIG.maskEmail),
  })
  .default(DEFAULT_WEB_CHAT_CONFIG)

export type WebChatConfig = z.infer<typeof webChatConfigSchema>
