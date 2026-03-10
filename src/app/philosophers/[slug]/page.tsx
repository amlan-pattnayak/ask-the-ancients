import PhilosopherDetailClient from "@/components/philosophers/PhilosopherDetailClient";

// Next.js 15 passes params as a Promise in server components
export default async function PhilosopherDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PhilosopherDetailClient slug={slug} />;
}
