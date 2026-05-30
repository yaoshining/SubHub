import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          SubHub 管理台工程骨架已就绪
        </p>
        <h1 className="mt-2 text-2xl font-semibold">下一步进入功能页面实现</h1>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/docs/api"
          >
            查看 API 文档骨架
          </Link>
        </div>
      </section>
    </main>
  );
}
