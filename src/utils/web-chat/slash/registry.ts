import type { SlashCommandDefinition } from "./types"
import { dichCommand } from "./commands/dich"
import { replyCommand } from "./commands/reply"
import { toneCommand } from "./commands/tone"
import { tplCommand } from "./commands/tpl"

const slashCommands: SlashCommandDefinition[] = [replyCommand, toneCommand, dichCommand, tplCommand]

export function registerSlashCommand(cmd: SlashCommandDefinition): void {
  const existingIdx = slashCommands.findIndex((c) => c.name === cmd.name)
  if (existingIdx >= 0) {
    slashCommands[existingIdx] = cmd
  } else {
    slashCommands.push(cmd)
  }
}

export function getAllSlashCommands(): readonly SlashCommandDefinition[] {
  return slashCommands
}

export interface ParsedSlashCommand {
  command: SlashCommandDefinition | null
  commandName: string
  langModifier?: string
  args: string
  isValidTrigger: boolean
}

/**
 * Parses user input into command name, language modifier, and arguments.
 * Ensures trigger condition: "/" is at beginning of line or preceded by whitespace.
 */
export function parseSlashCommandInput(input: string): ParsedSlashCommand {
  const trimmed = input.trimStart()
  if (!trimmed.startsWith("/")) {
    return {
      command: null,
      commandName: "",
      args: "",
      isValidTrigger: false,
    }
  }

  // Regex matches /cmd(:lang)? [args...]
  const match = /^\/([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?(?:\s+(.*))?$/s.exec(trimmed)
  if (!match?.[1]) {
    return {
      command: null,
      commandName: "",
      args: "",
      isValidTrigger: true, // Still typing a slash command
    }
  }

  const rawCmd = match[1].toLowerCase()
  const langModifier = match[2]?.toLowerCase()
  const args = match[3] || ""

  const found = slashCommands.find((c) => c.name === rawCmd || Boolean(c.aliases?.includes(rawCmd)))

  return {
    command: found || null,
    commandName: rawCmd,
    langModifier,
    args,
    isValidTrigger: true,
  }
}
