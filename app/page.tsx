import { db } from "@/lib/db";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { dailyContributorAddress } from "@/lib/db/schema";

export default async function Home() {
  // get today's contributor
  const today = new Date().toISOString().split('T')[0];
  const contributors = await db.query.dailyContributorAddress.findMany({
    where: eq(dailyContributorAddress.date, today),
  });


  return (
    <div>
      <h1>Today's Contributors</h1>
      <p>Contributors for {today}</p>
      <div>
        {contributors.length} contributors today
      </div>
      <ul>
        {contributors.map((contributor) => (
          <li key={contributor.id}>
            <span>{contributor.contributor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
