import CameraStream from "@/components/CameraStream";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Causeway Assistant
            </h1>
            <span className="text-sm text-zinc-400">
              Interactive Physical Task Guide
            </span>
          </div>
        </div>
      </header>
      <main className="py-8 space-y-8 max-w-5xl mx-auto px-4">
        {/* Live Camera View */}
        <section className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
          <CameraStream />
        </section>

        {/* Placeholder for Generative Instructions */}
        <section className="grid gap-4 mt-8">
          <div className="bg-zinc-100 dark:bg-zinc-800 p-12 rounded-xl text-center border-dashed border-2 border-zinc-300 dark:border-zinc-600 text-zinc-500">
            [AI Generated Media (Veo, Nano Banana) Next Step Appears Here]
          </div>
        </section>
      </main>
    </div>
  );
}
