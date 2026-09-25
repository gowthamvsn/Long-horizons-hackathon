import { AskArchive } from "@/components/chapters/AskArchive";
import { Dashboard } from "@/components/chapters/Dashboard";
import { loadSemester } from "@/lib/load";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { run, s } = await searchParams;
  const data = await loadSemester(typeof run === "string" ? run : undefined);
  return <Dashboard data={data} initialSession={Number(s) || 1} askSlot={<AskArchive run={data.run} />} />;
}
