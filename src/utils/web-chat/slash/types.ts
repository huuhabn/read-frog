import type { IChatAdapter } from "../adapter/types"

export interface SlashCommandContext {
  adapter: IChatAdapter
  inputElement: HTMLElement
  rawInput: string
  commandName: string
  args: string
  langModifier?: string
}

export interface SlashCommandResult {
  insertText?: string
  previewText?: string
  secondaryText?: string
  success: boolean
  error?: string
}

export interface SlashCommandDefinition {
  name: string
  aliases?: string[]
  description: string
  usage: string
  execute: (context: SlashCommandContext) => Promise<SlashCommandResult>
}
