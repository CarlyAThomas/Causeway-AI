import AnalyzerForm from "@/components/AnalyzerForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Causeway
          </h1>
          <span className="text-sm text-zinc-400">
            Multi-Perspective Reasoning Engine
          </span>
        </div>
      </header>
      <main className="py-8">
        <AnalyzerForm />
      </main>
    </div>
  );
}
