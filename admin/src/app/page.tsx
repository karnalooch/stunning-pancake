import React from 'react';
import { Card, Title, AreaChart, Text, Metric, Flex, Badge, Grid, ProgressBar } from "@tremor/react";
import { Activity, ShieldCheck, Users, Map as MapIcon, Settings, BarChart3, Bell } from "lucide-react";

// Mock data for the "WOW" effect
const activityData = [
  { time: "08:00", active: 120, flagged: 2 },
  { time: "10:00", active: 450, flagged: 5 },
  { time: "12:00", active: 890, flagged: 12 },
  { time: "14:00", active: 1200, flagged: 8 },
  { time: "16:00", active: 1500, flagged: 15 },
  { time: "18:00", active: 2100, flagged: 4 },
];

export default function ObsidianDashboard() {
  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Sidebar - Obsidian Glassmorphism */}
      <aside className="w-64 bg-black/40 backdrop-blur-xl border-r border-cyan-500/10 flex flex-col p-6 gap-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-purple-600 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(0,242,255,0.4)]">
            <Activity className="text-black w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent">SPORT</span>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem icon={<BarChart3 />} label="Dashboard" active />
          <NavItem icon={<MapIcon />} label="Live Map" />
          <NavItem icon={<ShieldCheck />} label="Anti-Cheat" badge="12" />
          <NavItem icon={<Users />} label="Tenants" />
          <NavItem icon={<Bell />} label="Events" />
          <NavItem icon={<Settings />} label="Settings" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Ecosystem Intelligence</h1>
            <p className="text-gray-400 mt-1">Real-time telemetry and validation status — Milestone 6 Foundation</p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 font-medium hover:bg-cyan-500/20 transition-all shadow-[0_0_15px_rgba(0,242,255,0.1)]">Export Data</button>
            <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700"></div>
          </div>
        </header>

        {/* KPI Grid */}
        <Grid numItemsMd={2} numItemsLg={4} className="gap-6">
          <StatsCard title="Total Athletes" value="42,890" delta="+12%" icon={<Users className="text-cyan-400" />} />
          <StatsCard title="Verified Tracks" value="1.2M" delta="+5.2%" icon={<ShieldCheck className="text-green-400" />} />
          <StatsCard title="System Load" value="14ms" delta="Optimal" icon={<Activity className="text-purple-400" />} />
          <StatsCard title="Active Events" value="156" delta="Global" icon={<Bell className="text-orange-400" />} />
        </Grid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart */}
          <Card className="lg:col-span-2 bg-black/40 backdrop-blur-md border-cyan-500/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <Title className="text-white">Live Activity Ingestion</Title>
            <Text className="text-gray-400">Sync v2.0 Performance (FastAPI Ingest)</Text>
            <AreaChart
              className="h-80 mt-10"
              data={activityData}
              index="time"
              categories={["active", "flagged"]}
              colors={["cyan", "purple"]}
              showLegend={true}
              showGridLines={false}
              valueFormatter={(number: number) => `${Intl.NumberFormat("us").format(number).toString()}`}
            />
          </Card>

          {/* Integrity Gauge - Custom Mockup */}
          <Card className="bg-black/40 backdrop-blur-md border-purple-500/10 flex flex-col justify-between">
            <div>
              <Title className="text-white">Ecosystem Integrity</Title>
              <Text className="text-gray-400">Current Anti-Cheat Confidence</Text>
            </div>
            
            <div className="flex flex-col items-center justify-center py-10">
              <div className="relative w-48 h-48 rounded-full border-[10px] border-gray-800 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-[10px] border-cyan-500/40 blur-sm"></div>
                <div className="text-center">
                  <span className="text-5xl font-black text-cyan-400 shadow-[0_0_15px_rgba(0,242,255,0.5)]">98.2</span>
                  <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Score</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Flex>
                <Text className="text-gray-400">Validation Accuracy</Text>
                <Text className="text-cyan-400">99.9%</Text>
              </Flex>
              <ProgressBar value={99} color="cyan" className="mt-1" />
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, badge }: { icon: any, label: string, active?: boolean, badge?: string }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${active ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-gray-400 hover:bg-white/5'}`}>
      <div className="flex items-center gap-3">
        {React.cloneElement(icon, { size: 20 })}
        <span className="font-medium">{label}</span>
      </div>
      {badge && <span className="px-2 py-0.5 bg-purple-500 text-[10px] text-white font-bold rounded-full">{badge}</span>}
    </div>
  );
}

function StatsCard({ title, value, delta, icon }: { title: string, value: string, delta: string, icon: any }) {
  return (
    <Card className="bg-black/40 backdrop-blur-md border-white/5 hover:border-cyan-500/30 transition-all group shadow-xl">
      <Flex alignItems="start">
        <div>
          <Text className="text-gray-500 font-medium uppercase text-xs tracking-wider">{title}</Text>
          <Metric className="text-white mt-1 group-hover:text-cyan-400 transition-colors">{value}</Metric>
        </div>
        <div className="p-3 bg-white/5 rounded-xl group-hover:bg-cyan-500/10 transition-all">
          {icon}
        </div>
      </Flex>
      <div className="mt-4 flex items-center gap-2">
        <Badge color={delta.includes('+') ? "emerald" : "indigo"}>{delta}</Badge>
        <Text className="text-[10px] text-gray-600">vs. last 24h</Text>
      </div>
    </Card>
  );
}
