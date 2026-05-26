import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons/lucide";

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground sm:px-8 lg:px-12">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-between rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-sm text-muted-foreground">
              <Icons.PanelLeft className="h-4 w-4" aria-hidden="true" />
              Admin Console Skeleton
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                SubHub 管理台工程骨架
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                当前仅落地 Next.js、TailwindCSS、shadcn/ui、Lucide
                与测试工具链基线，后续页面按 spec 与 page spec 继续实现。
              </p>
            </div>
          </div>
          <Button className="w-full sm:w-auto">
            <Icons.Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            工具链就绪
          </Button>
        </div>

        <div className="grid gap-4 pt-10 md:grid-cols-3">
          {["严格 TypeScript", "主题 Token", "集中 Lucide 导出"].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-border bg-surface-muted p-4"
            >
              <p className="text-sm font-medium text-foreground">{item}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                供后续 issue 复用的最小基础能力。
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
