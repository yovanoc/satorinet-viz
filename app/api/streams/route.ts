import { streamsSearch } from "@/lib/satorinet/central";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = await streamsSearch();
  return new Response(JSON.stringify(res), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
