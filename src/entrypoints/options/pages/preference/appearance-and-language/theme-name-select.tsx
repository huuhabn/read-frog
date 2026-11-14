import type { ComponentProps } from "react"
import type { ThemeName } from "@/types/config/theme"
import { useTheme } from "@/components/providers/theme-provider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { THEMES, themeNames } from "@/types/config/theme"

export function ThemeNameSelect({
  className,
  size,
}: {
  className?: string
  size?: ComponentProps<typeof SelectTrigger>["size"]
}) {
  const { themeName, setThemeName } = useTheme()

  return (
    <Select value={themeName} onValueChange={(value) => setThemeName(value as ThemeName)}>
      <SelectTrigger className={className} size={size}>
        <SelectValue render={<span />}>
          <span className="flex items-center gap-2">
            <span
              className="size-3 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: THEMES[themeName].color }}
            />
            {THEMES[themeName].name}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectGroup>
          {themeNames.map((name) => (
            <SelectItem key={name} value={name}>
              <span className="flex items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: THEMES[name].color }}
                />
                {THEMES[name].name}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
