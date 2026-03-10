import PhilosopherBrowser from "@/components/philosophers/PhilosopherBrowser";
import BottomNav from "@/components/layout/BottomNav";
import Navbar from "@/components/layout/Navbar";

export default function PhilosophersPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      <Navbar />
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 md:py-10">
        <header className="flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)", opacity: 0.75 }}
          >
            Library
          </p>
          <h1
            className="font-serif text-3xl font-semibold md:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Philosophers
          </h1>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Browse thinkers across schools and traditions, then begin a dialogue.
          </p>
        </header>
        <PhilosopherBrowser />
      </main>
      <BottomNav />
    </div>
  );
}
