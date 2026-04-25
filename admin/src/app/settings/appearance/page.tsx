"use client";

import React, { useState } from 'react';
import { Card, Title, Text, Grid, Button, Flex, Icon } from "@tremor/react";
import { 
  Activity, ShieldCheck, Users, Map as MapIcon, 
  Settings, BarChart3, Bell, Zap, Trophy, 
  Target, Rocket, Heart, Flame, Search
} from "lucide-react";

const availableIcons = [
  { name: 'Activity', icon: Activity },
  { name: 'Shield', icon: ShieldCheck },
  { name: 'Users', icon: Users },
  { name: 'Map', icon: MapIcon },
  { name: 'Dashboard', icon: BarChart3 },
  { name: 'Events', icon: Bell },
  { name: 'Zap', icon: Zap },
  { name: 'Trophy', icon: Trophy },
  { name: 'Target', icon: Target },
  { name: 'Rocket', icon: Rocket },
  { name: 'Heart', icon: Heart },
  { name: 'Flame', icon: Flame },
];

export default function AppearanceManager() {
  const [selectedIcon, setSelectedIcon] = useState('Activity');
  const [accentColor, setAccentColor] = useState('#00f2ff');
  const [glowIntensity, setGlowIntensity] = useState(20);

  return (
    <main className="p-10 bg-[#050505] min-h-screen text-white">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Visual System Manager</h1>
        <p className="text-gray-400 mt-1">Modify system aesthetics "on the fly" — Obsidian Design Protocol</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Icon Manager */}
        <Card className="lg:col-span-2 bg-black/40 backdrop-blur-md border-cyan-500/10">
          <Title className="text-white">Icon Manager</Title>
          <Text className="text-gray-400 mb-6">Assign system icons to navigation modules</p>
          
          <Grid numItemsSm={3} numItemsMd={4} numItemsLg={6} className="gap-4">
            {availableIcons.map((item) => (
              <div 
                key={item.name}
                onClick={() => setSelectedIcon(item.name)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedIcon === item.name 
                  ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(0,242,255,0.3)]' 
                  : 'border-white/5 hover:border-white/20 bg-white/5'
                }`}
              >
                <item.icon className={selectedIcon === item.name ? 'text-cyan-400' : 'text-gray-400'} size={28} />
                <span className="text-[10px] mt-2 uppercase tracking-widest text-gray-500">{item.name}</span>
              </div>
            ))}
          </Grid>

          <div className="mt-10 p-6 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-between">
            <div>
              <Text className="text-white font-bold">Primary Navigation Icon</Text>
              <Text className="text-xs text-gray-500 italic">Currently assigned: {selectedIcon}</Text>
            </div>
            <Button variant="primary" color="cyan" className="neon-glow-cyan">Apply to All Tenants</Button>
          </div>
        </Card>

        {/* Theme Customizer */}
        <div className="space-y-8">
          <Card className="bg-black/40 backdrop-blur-md border-purple-500/10">
            <Title className="text-white">Neon Protocol</Title>
            <Text className="text-gray-400 mb-6">Adjust aura and glow parameters</p>
            
            <div className="space-y-6">
              <div>
                <Flex>
                  <Text className="text-gray-300">Accent Color</Text>
                  <Text className="text-cyan-400">{accentColor}</Text>
                </Flex>
                <input 
                  type="color" 
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-full h-10 mt-2 bg-transparent border-none cursor-pointer"
                />
              </div>

              <div>
                <Flex>
                  <Text className="text-gray-300">Glow Intensity</Text>
                  <Text className="text-purple-400">{glowIntensity}px</Text>
                </Flex>
                <input 
                  type="range" 
                  min="0" max="100" 
                  value={glowIntensity}
                  onChange={(e) => setGlowIntensity(parseInt(e.target.value))}
                  className="w-full mt-2 accent-purple-500"
                />
              </div>

              <div className="pt-4 border-t border-white/5">
                <Text className="text-xs text-gray-500 mb-4 uppercase tracking-widest">Preview Pane</Text>
                <div 
                  className="w-full h-32 rounded-2xl flex items-center justify-center text-2xl font-black italic tracking-tighter"
                  style={{ 
                    backgroundColor: `${accentColor}10`,
                    border: `1px solid ${accentColor}30`,
                    color: accentColor,
                    boxShadow: `0 0 ${glowIntensity}px ${accentColor}40`
                  }}
                >
                  PREVIEW
                </div>
              </div>
            </div>
          </Card>

          <Button 
            className="w-full py-4 rounded-xl font-bold tracking-widest uppercase bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 transition-all shadow-2xl"
          >
            Save Global Schema
          </Button>
        </div>
      </div>
    </main>
  );
}
