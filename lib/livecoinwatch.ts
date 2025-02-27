import ky from 'ky';
import { env } from './env';

interface LiveCoinWatchResult {
    history: { date: number; rate: number }[];
}
export async function getSatoriPriceForDate(date: Date): Promise<number> {
    const delay = 450 * 1000; // 450 seconds in milliseconds
    const end = date.getTime() + delay;
    const start = date.getTime() - delay;

    const res = await getSatoriPriceLivecoinwatch(start, end);

    // Take the closest price to the time
    const closest = res.history.reduce((prev, curr) =>
        Math.abs(date.getTime() - curr.date) < Math.abs(date.getTime() - prev.date) ? curr : prev
    );

    const diff = Math.abs(closest.date - date.getTime());

    if (diff > delay) {
        console.error(`No price found for date: ${date} - ${JSON.stringify(closest)} - diff ${diff} ms`);
        throw new Error("No price found");
    }

    return closest.rate;
}

async function getSatoriPriceLivecoinwatch(start: number, end: number): Promise<LiveCoinWatchResult> {
    return await ky.post('https://api.livecoinwatch.com/coins/single/history', {
        headers: {
            'x-api-key': env.LIVECOINWATCH_API_KEY,
            'Content-Type': 'application/json'
        },
        json: {
            currency: "USD",
            code: "SATORI",
            start,
            end,
        },
        timeout: 15000 // 15 seconds
    }).json<LiveCoinWatchResult>();
}
