import TabsLayout from "@/components/TabsLayout";
import MultiPoolWorkerComparison from "@/components/multi-pool-worker-comparison";

export default function Compare() {
  return (
    <TabsLayout>
      <MultiPoolWorkerComparison date={new Date()} />
    </TabsLayout>
  );
}
