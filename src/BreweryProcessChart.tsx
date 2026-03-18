/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ProcessChartProps, StationConfig, FlowConnection } from './types';

// ─── Layout constants ──────────────────────────────────────────────────────

const VB_W = 820;
const VB_H = 460;
const CARD_W = 155;
const CARD_H = 105;

// Station layout: U-shape (top row left→right, bottom row right→left)
// Top:    Stock(35,55)  →  Bar(335,55)  →  Waiters(635,55)
// Bottom: Served(35,300) ← Tables(335,300) ← Customers(635,300)

const STATIONS: StationConfig[] = [
  { id: 'StockProbe',    label: 'STOCK',    icon: '📦', maxCapacity: 50,  x: 35,  y: 55  },
  { id: 'BarProbe',      label: 'BAR',      icon: '🍺', maxCapacity: 15,  x: 335, y: 55  },
  { id: 'WaiterProbe',   label: 'SERVEURS', icon: '🧑‍🍳', maxCapacity: 5,   x: 635, y: 55  },
  { id: 'CustomerProbe', label: 'CLIENTS',  icon: '👥', maxCapacity: 30,  x: 635, y: 300 },
  { id: 'TableProbe',    label: 'TABLES',   icon: '🪑', maxCapacity: 12,  x: 335, y: 300 },
  { id: 'ServedProbe',   label: 'SORTIE',   icon: '🚪', maxCapacity: 100, x: 35,  y: 300 },
];

const CONNECTIONS: FlowConnection[] = [
  { from: 'StockProbe',    to: 'BarProbe'      },
  { from: 'BarProbe',      to: 'WaiterProbe'   },
  { from: 'WaiterProbe',   to: 'CustomerProbe' },
  { from: 'CustomerProbe', to: 'TableProbe'    },
  { from: 'TableProbe',    to: 'ServedProbe'   },
];

// ─── Colour helper ────────────────────────────────────────────────────────

function statusColor(pct: number): string {
  if (pct >= 0.5) return '#27ae60';
  if (pct >= 0.2) return '#f39c12';
  return '#e74c3c';
}

// ─── StationCard ──────────────────────────────────────────────────────────

interface StationCardProps {
  config: StationConfig;
  value: number;
}

function StationCard({ config, value }: StationCardProps) {
  const pct = config.maxCapacity > 0 ? Math.min(1, value / config.maxCapacity) : 0;
  const color = statusColor(pct);
  const gaugeW = Math.round(pct * (CARD_W - 24));
  const isLow = pct < 0.2;

  return (
    <g transform={`translate(${config.x},${config.y})`}>
      {/* Shadow */}
      <rect x={4} y={4} width={CARD_W} height={CARD_H} rx={12} fill="rgba(0,0,0,0.12)" />
      {/* Card */}
      <rect width={CARD_W} height={CARD_H} rx={12} fill="white" stroke="#dee2e6" strokeWidth={1.5} />

      {/* Icon + label */}
      <text x={12} y={28} fontSize={18} dominantBaseline="middle">{config.icon}</text>
      <text x={36} y={28} fontSize={13} fontWeight="bold" fill="#2c3e50" dominantBaseline="middle">
        {config.label}
      </text>

      {/* Gauge track */}
      <rect x={12} y={44} width={CARD_W - 24} height={13} rx={6} fill="#f0f0f0" />
      {/* Gauge fill — CSS transition via style prop */}
      <rect
        x={12}
        y={44}
        width={gaugeW}
        height={13}
        rx={6}
        fill={color}
        style={{ transition: 'width 0.45s ease, fill 0.45s ease' }}
      />

      {/* Value text */}
      <text x={12} y={76} fontSize={12} fill="#555">
        {Math.round(value)} / {config.maxCapacity}
      </text>

      {/* Percent */}
      <text x={CARD_W - 42} y={76} fontSize={11} fill={color} fontWeight="bold">
        {Math.round(pct * 100)}%
      </text>

      {/* Status dot — blinks when critical */}
      <circle cx={CARD_W - 14} cy={28} r={7} fill={color}>
        {isLow && (
          <animate attributeName="opacity" values="1;0.15;1" dur="0.9s" repeatCount="indefinite" />
        )}
      </circle>
    </g>
  );
}

// ─── FlowArrow ────────────────────────────────────────────────────────────

interface FlowArrowProps {
  conn: FlowConnection;
  flux: number;
}

function connectionPoints(conn: FlowConnection): [number, number, number, number] {
  const from = STATIONS.find(s => s.id === conn.from)!;
  const to   = STATIONS.find(s => s.id === conn.to)!;

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // horizontal
    if (dx > 0) {
      return [from.x + CARD_W, from.y + CARD_H / 2, to.x, to.y + CARD_H / 2];
    }
    return [from.x, from.y + CARD_H / 2, to.x + CARD_W, to.y + CARD_H / 2];
  }
  // vertical
  if (dy > 0) {
    return [from.x + CARD_W / 2, from.y + CARD_H, to.x + CARD_W / 2, to.y];
  }
  return [from.x + CARD_W / 2, from.y, to.x + CARD_W / 2, to.y + CARD_H];
}

function FlowArrow({ conn, flux }: FlowArrowProps) {
  const [x1, y1, x2, y2] = connectionPoints(conn);
  const sw = Math.max(2, Math.min(6, flux * 0.3 + 2));
  const op = flux < 0.5 ? 0.2 : 0.75;
  const markerId = `mk-${conn.from}-${conn.to}`;
  const animDur = `${Math.max(0.6, 1.5 - flux * 0.05)}s`;

  return (
    <g>
      <defs>
        <marker id={markerId} markerWidth="9" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0,9 3,0 6" fill="#3498db" fillOpacity={op} />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#3498db"
        strokeWidth={sw}
        strokeOpacity={op}
        strokeDasharray="10 5"
        markerEnd={`url(#${markerId})`}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="15"
          to="0"
          dur={animDur}
          repeatCount="indefinite"
        />
      </line>
    </g>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function BreweryProcessChart(props: ProcessChartProps) {
  const {
    width,
    height,
    data,
    timeColumn,
    stationColumn,
    valueColumn,
    scenarioColumn,
    animationSpeed,
    stationCapacities,
  } = props;

  // Parse capacities JSON, fallback to STATIONS defaults on error
  const capacities: Record<string, number> = useMemo(() => {
    try { return JSON.parse(stationCapacities); } catch { return {}; }
  }, [stationCapacities]);

  const stations: StationConfig[] = useMemo(
    () => STATIONS.map(s => ({ ...s, maxCapacity: capacities[s.id] ?? s.maxCapacity })),
    [capacities],
  );

  // Unique scenarios and sorted steps
  const scenarios = useMemo(() => {
    const s = new Set<string>();
    data.forEach((r: any) => { if (r[scenarioColumn]) s.add(r[scenarioColumn]); });
    return Array.from(s).sort();
  }, [data, scenarioColumn]);

  const steps = useMemo(() => {
    const s = new Set<number>();
    data.forEach((r: any) => s.add(Number(r[timeColumn])));
    return Array.from(s).sort((a, b) => a - b);
  }, [data, timeColumn]);

  const maxStepIdx = Math.max(0, steps.length - 1);

  // Indexed data: scenario → stepValue → station → value
  const dataMap = useMemo(() => {
    const m = new Map<string, Map<number, Map<string, number>>>();
    data.forEach((r: any) => {
      const sc = r[scenarioColumn];
      const st = Number(r[timeColumn]);
      const id = r[stationColumn];
      const v  = Number(r[valueColumn]);
      if (!m.has(sc)) m.set(sc, new Map());
      if (!m.get(sc)!.has(st)) m.get(sc)!.set(st, new Map());
      m.get(sc)!.get(st)!.set(id, v);
    });
    return m;
  }, [data, scenarioColumn, timeColumn, stationColumn, valueColumn]);

  // Animation state
  const [stepIdx,   setStepIdx]   = useState(0);
  const [playing,   setPlaying]   = useState(false);
  const [speed,     setSpeed]     = useState(animationSpeed || 1);
  const [scenario,  setScenario]  = useState('');

  useEffect(() => {
    if (scenarios.length > 0 && !scenario) setScenario(scenarios[0]);
  }, [scenarios, scenario]);

  // Autoplay loop
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setStepIdx(prev => (prev >= maxStepIdx ? 0 : prev + 1)),
      1000 / speed,
    );
    return () => clearInterval(id);
  }, [playing, speed, maxStepIdx]);

  const togglePlay  = useCallback(() => setPlaying(p => !p), []);
  const cycleSpeed  = useCallback(() => setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1), []);

  // Current step values
  const currentStep = steps[stepIdx];
  const stepData    = dataMap.get(scenario)?.get(currentStep);

  const currentValues = useMemo(() => {
    const v: Record<string, number> = {};
    stations.forEach(s => { v[s.id] = stepData?.get(s.id) ?? 0; });
    return v;
  }, [stepData, stations]);

  // Flux = absolute delta of the "from" station vs previous step
  const fluxValues = useMemo(() => {
    const prevStep = steps[Math.max(0, stepIdx - 1)];
    const prev     = dataMap.get(scenario)?.get(prevStep);
    const curr     = dataMap.get(scenario)?.get(currentStep);
    const f: Record<string, number> = {};
    CONNECTIONS.forEach(c => {
      const pv = prev?.get(c.from) ?? 0;
      const cv = curr?.get(c.from) ?? 0;
      f[`${c.from}-${c.to}`] = Math.abs(cv - pv);
    });
    return f;
  }, [dataMap, scenario, stepIdx, steps, currentStep]);

  // Styles (all inline — no external CSS file)
  const outerStyle: React.CSSProperties = {
    width, height,
    display: 'flex', flexDirection: 'column',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: '#f4f6f8',
    borderRadius: 8,
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const barStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 14px',
    background: '#1a252f',
    color: 'white',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  };

  const btnBase: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 5, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 'bold',
  };

  const timelineStyle: React.CSSProperties = {
    padding: '6px 14px 8px',
    background: '#ecf0f1',
    flexShrink: 0,
  };

  return (
    <div style={outerStyle}>

      {/* ── Control bar ─────────────────────────────────────────── */}
      <div style={barStyle}>
        <span style={{ fontSize: 20 }}>🍺</span>
        <span style={{ fontWeight: 'bold', fontSize: 14, marginRight: 6 }}>Brewery Simulation</span>

        <select
          value={scenario}
          onChange={e => { setScenario(e.target.value); setStepIdx(0); setPlaying(false); }}
          style={{ padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 12, maxWidth: 200 }}
        >
          {scenarios.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={togglePlay}
            style={{ ...btnBase, background: playing ? '#c0392b' : '#27ae60', color: 'white', fontSize: 16 }}
          >
            {playing ? '⏸' : '▶'}
          </button>

          <button
            onClick={cycleSpeed}
            style={{ ...btnBase, background: '#2980b9', color: 'white' }}
          >
            ×{speed}
          </button>

          <span style={{ fontSize: 12, opacity: 0.75, minWidth: 80 }}>
            Step {currentStep ?? 0} / {steps[maxStepIdx] ?? 0}
          </span>
        </div>
      </div>

      {/* ── SVG area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <style>{`
              @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
            `}</style>
          </defs>

          {/* Flow arrows (below cards) */}
          {CONNECTIONS.map(c => (
            <FlowArrow
              key={`${c.from}-${c.to}`}
              conn={c}
              flux={fluxValues[`${c.from}-${c.to}`] ?? 0}
            />
          ))}

          {/* Station cards */}
          {stations.map(s => (
            <StationCard
              key={s.id}
              config={s}
              value={currentValues[s.id] ?? 0}
            />
          ))}
        </svg>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────── */}
      <div style={timelineStyle}>
        <input
          type="range"
          min={0}
          max={maxStepIdx}
          value={stepIdx}
          onChange={e => { setStepIdx(Number(e.target.value)); setPlaying(false); }}
          style={{ width: '100%', cursor: 'pointer', accentColor: '#2980b9' }}
        />
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: '#7f8c8d', marginTop: 2,
        }}>
          {steps
            .filter((_, i) => i % Math.max(1, Math.ceil(steps.length / 10)) === 0)
            .map(s => <span key={s}>{s}</span>)
          }
          {steps.length > 0 && <span>{steps[maxStepIdx]}</span>}
        </div>
      </div>

    </div>
  );
}
