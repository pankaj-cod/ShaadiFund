import type { ComponentProps } from "react";
import { getTheme } from "./themes";

interface ThemeScopeProps extends ComponentProps<"div"> {
  theme: string | null | undefined;
}

/** Applies a wedding theme's tokens to everything inside it. */
export function ThemeScope({ theme, children, ...props }: ThemeScopeProps) {
  return (
    <div data-theme={getTheme(theme).attribute} {...props}>
      {children}
    </div>
  );
}
