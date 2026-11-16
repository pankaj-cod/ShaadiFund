import type { Metadata } from "next";
import { ThemeScope } from "@/components/themes/theme-scope";
import { THEME_KEYS, THEMES } from "@/components/themes/themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FundingProgress } from "@/components/ui/funding-progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const SWATCHES = [
  ["Background", "bg-background"],
  ["Card", "bg-card"],
  ["Secondary", "bg-secondary"],
  ["Accent", "bg-accent"],
  ["Gold", "bg-gold"],
  ["Primary", "bg-primary"],
] as const;

/** Internal reference page: every token and base component, in each wedding theme. */
export default function DesignSystemPage() {
  return (
    <main className="flex-1">
      <header className="max-w-page mx-auto px-6 pt-16 pb-10">
        <p className="eyebrow">Internal reference</p>
        <h1 className="text-h1 mt-4">ShaadiFund design system</h1>
        <p className="text-lead text-muted-foreground mt-4 max-w-prose">
          The same components shown in each of the three wedding themes. Sample content only.
        </p>
      </header>

      {THEME_KEYS.map((key) => {
        const theme = THEMES[key];
        return (
          <ThemeScope key={key} theme={key} className="border-t">
            <section
              className="max-w-page mx-auto grid gap-12 px-6 py-16 lg:grid-cols-2"
              aria-labelledby={`theme-${theme.attribute}`}
            >
              <div>
                <p className="eyebrow">Theme</p>
                <h2 id={`theme-${theme.attribute}`} className="text-h2 mt-3">
                  {theme.name}
                </h2>
                <p className="text-muted-foreground mt-2">{theme.description}</p>

                <p className="text-display font-heading mt-10 italic">Riya &amp; Rahul</p>
                <p className="text-h3 font-heading mt-4">Our first trip as a married couple</p>
                <p className="text-muted-foreground mt-3 max-w-prose">
                  Body text is set in a clean sans-serif for comfortable reading on a phone, with
                  generous line height and a warm, muted secondary colour.
                </p>

                <ul className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {SWATCHES.map(([name, className]) => (
                    <li key={name} className="text-center">
                      <div className={`${className} aspect-square rounded-md border`} />
                      <span className="text-muted-foreground mt-2 block text-xs">{name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-8">
                <div className="flex flex-wrap gap-3">
                  <Button size="lg">Contribute to this dream</Button>
                  <Button size="lg" variant="outline">
                    Read their story
                  </Button>
                  <Button size="lg" variant="secondary">
                    Share
                  </Button>
                  <Button size="lg" disabled>
                    Disabled
                  </Button>
                </div>

                <Card className="shadow-soft">
                  <CardHeader>
                    <p className="eyebrow">Honeymoon</p>
                    <CardTitle className="font-heading text-h3 font-medium">
                      A week in the Swiss Alps
                    </CardTitle>
                    <CardDescription>
                      Train rides through the mountains and a first snowfall together.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FundingProgress
                      label="A week in the Swiss Alps"
                      fundedPaise={18_750_000}
                      targetPaise={30_000_000}
                    />
                  </CardContent>
                </Card>

                <div className="grid gap-2">
                  <Label htmlFor={`name-${theme.attribute}`}>Your name</Label>
                  <Input
                    id={`name-${theme.attribute}`}
                    name="name"
                    autoComplete="name"
                    placeholder="As you would like the couple to see it"
                    className="bg-card h-11"
                  />
                </div>
              </div>
            </section>
          </ThemeScope>
        );
      })}
    </main>
  );
}
