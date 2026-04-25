import { Card, Title, AreaChart, Text } from "@tremor/react";

const chartdata = [
  { date: "Jan 22", "Active Users": 2890, "Activities": 2338 },
  { date: "Feb 22", "Active Users": 2756, "Activities": 2103 },
  { date: "Mar 22", "Active Users": 3322, "Activities": 2194 },
];

export default function DashboardPage() {
  return (
    <main className="p-10 bg-slate-50 min-h-screen">
      <Title>SPORT Management Dashboard</Title>
      <Text>Real-time ecosystem performance analytics (Next.js 15 RSC)</Text>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <Card>
          <Title>Activity Trends</Title>
          <AreaChart
            className="h-72 mt-4"
            data={chartdata}
            index="date"
            categories={["Active Users", "Activities"]}
            colors={["indigo", "cyan"]}
          />
        </Card>
        
        <Card className="flex items-center justify-center">
          <Text className="italic">WebGL Map View (deck.gl) — Initializing...</Text>
        </Card>
      </div>
    </main>
  );
}
