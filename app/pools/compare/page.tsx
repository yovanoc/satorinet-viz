import MultiPoolWorkerComparison from "@/components/old/multi-pool-worker-comparison";

export default function PoolsCompare() {
  return (
    <div className="flex flex-col py-4 gap-4 px-4 lg:px-6 h-full">
      <MultiPoolWorkerComparison date={new Date()} />
    </div>
  );
}
