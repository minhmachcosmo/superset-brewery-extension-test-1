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
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProcessChartProps, StationConfig, FlowConnection } from './types';
import {
  generateClientDetails,
  generateWaiterDetails,
  generateTableDetails,
  generateStockItemDetails,
  generateOrderDetails,
  satisfactionEmoji,
} from './detailGenerators';

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
  { id: 'BarProbe',      label: 'PREPARATION', icon: '🍺', maxCapacity: 15,  x: 335, y: 55  },
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

function statusDot(status: string): string {
  const map: Record<string, string> = {
    ok: '🟢', low: '🟡', critical: '🔴',
    active: '🟢', break: '🟡', off: '⚫',
    free: '🟢', occupied: '🔴', reserved: '🟡', maintenance: '⚫',
    ready: '🟢', preparing: '🟡', waiting: '🔴',
  };
  return map[status] ?? '⚪';
}

// ─── Sparkline ────────────────────────────────────────────────────────────

interface SparklineProps {
  values: number[];
  currentIdx: number;
  width: number;
  height: number;
}

function Sparkline({ values, currentIdx, width, height }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pad = 4;
  const iw = width - pad * 2;
  const ih = height - pad * 2;
  const tx = (i: number) => pad + (i / (values.length - 1)) * iw;
  const ty = (v: number) => pad + ih - (v / max) * ih;
  const pts = values.map((v, i) => `${tx(i).toFixed(1)},${ty(v).toFixed(1)}`).join(' ');
  const area = `${tx(0).toFixed(1)},${(pad + ih).toFixed(1)} ${pts} ${tx(values.length - 1).toFixed(1)},${(pad + ih).toFixed(1)}`;
  const cx = tx(Math.min(currentIdx, values.length - 1));
  const cy = ty(values[Math.min(currentIdx, values.length - 1)] ?? 0);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polygon points={area} fill="#3498db" fillOpacity={0.12} />
      <polyline points={pts} fill="none" stroke="#3498db" strokeWidth={2} />
      <line x1={cx} y1={pad} x2={cx} y2={pad + ih} stroke="#e74c3c" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
      <circle cx={cx} cy={cy} r={4} fill="#e74c3c" />
    </svg>
  );
}

// ─── Popup style helper ───────────────────────────────────────────────────

function getPopupStyle(station: StationConfig): React.CSSProperties {
  const isRight = station.x + CARD_W / 2 > VB_W / 2;
  const isBottom = station.y + CARD_H / 2 > VB_H / 2;
  const pos: React.CSSProperties = {};

  if (isRight) {
    pos.right = `${((VB_W - station.x) / VB_W * 100).toFixed(1)}%`;
  } else {
    pos.left = `${((station.x + CARD_W + 8) / VB_W * 100).toFixed(1)}%`;
  }
  if (isBottom) {
    pos.bottom = `${((VB_H - station.y + 8) / VB_H * 100).toFixed(1)}%`;
  } else {
    pos.top = `${((station.y + CARD_H + 8) / VB_H * 100).toFixed(1)}%`;
  }

  return {
    position: 'absolute',
    width: 285,
    background: 'white',
    borderRadius: 10,
    boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
    zIndex: 200,
    padding: '10px 12px 12px',
    fontFamily: "'Segoe UI', Arial, sans-serif",
    maxHeight: 420,
    overflowY: 'auto',
    ...pos,
  };
}

// ─── Table style constants ─────────────────────────────────────────────────

const TBL: React.CSSProperties = { width: '100%', fontSize: 11, borderCollapse: 'collapse' };
const TH: React.CSSProperties  = { padding: '2px 4px', fontWeight: 'normal', fontSize: 10, color: '#999' };
const TD: React.CSSProperties  = { padding: '3px 4px', color: '#333' };
const TR_HEAD: React.CSSProperties = { borderBottom: '1px solid #eee' };
const TR_BODY: React.CSSProperties = { borderBottom: '1px solid #f8f8f8' };
const FOOTER: React.CSSProperties  = { marginTop: 8, fontSize: 11, color: '#666', borderTop: '1px solid #eee', paddingTop: 6 };

// ─── Station content components ───────────────────────────────────────────

function StockContent({ scenario, step, value }: { scenario: string; step: number; value: number }) {
  const items = generateStockItemDetails(scenario, step, value);
  const totalMax = items.reduce((s, i) => s + i.maxQuantity, 0);
  const hasCritical = items.some(i => i.status === 'critical');
  const hasLow = items.some(i => i.status === 'low');
  const forecast = hasCritical ? '~3 steps' : hasLow ? '~7 steps' : 'Aucune prévue';

  return (
    <div>
      <div style={{ marginBottom: 6, fontSize: 11, color: '#555' }}>
        Total : <b>{Math.round(value)} / {totalMax}</b>
      </div>
      <table style={TBL}>
        <thead>
          <tr style={TR_HEAD}>
            <th style={{ ...TH, textAlign: 'left' }}>Produit</th>
            <th style={{ ...TH, textAlign: 'right' }}>Qté</th>
            <th style={{ ...TH, textAlign: 'center' }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.productName} style={TR_BODY}>
              <td style={TD}>{item.productName}</td>
              <td style={{ ...TD, textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ ...TD, textAlign: 'center' }}>
                {statusDot(item.status)} {item.status === 'ok' ? 'OK' : item.status === 'low' ? 'Bas' : 'Critique'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={FOOTER}>Prévision rupture : {forecast}</div>
    </div>
  );
}

function PrepContent({ scenario, step, value }: { scenario: string; step: number; value: number }) {
  const orders = generateOrderDetails(scenario, step, value);
  const avgDur = orders.length > 0
    ? (orders.reduce((a, o) => a + o.durationMin, 0) / orders.length).toFixed(1)
    : '—';

  return (
    <div>
      <table style={TBL}>
        <thead>
          <tr style={TR_HEAD}>
            <th style={{ ...TH, textAlign: 'left' }}>Commande</th>
            <th style={{ ...TH, textAlign: 'left' }}>Produit</th>
            <th style={{ ...TH, textAlign: 'center' }}>Statut</th>
            <th style={{ ...TH, textAlign: 'right' }}>Durée</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.orderId} style={TR_BODY}>
              <td style={{ ...TD, color: '#888', fontFamily: 'monospace' }}>{o.orderId}</td>
              <td style={TD}>{o.productName}</td>
              <td style={{ ...TD, textAlign: 'center' }}>
                {statusDot(o.status)} {o.status === 'ready' ? 'Prêt' : o.status === 'preparing' ? 'Prep' : 'Att.'}
              </td>
              <td style={{ ...TD, textAlign: 'right', color: '#555' }}>{o.durationMin} min</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={FOOTER}>Temps moyen préparation : <b>{avgDur} min</b></div>
    </div>
  );
}

function WaitersContent({ scenario, step, value }: { scenario: string; step: number; value: number }) {
  const waiters = generateWaiterDetails(scenario, step, value);
  const totalServed = waiters.reduce((a, w) => a + w.clientsServed, 0);

  return (
    <div>
      <table style={TBL}>
        <thead>
          <tr style={TR_HEAD}>
            <th style={{ ...TH, textAlign: 'left' }}>Serveur</th>
            <th style={{ ...TH, textAlign: 'center' }}>Statut</th>
            <th style={{ ...TH, textAlign: 'right' }}>Clients servis</th>
          </tr>
        </thead>
        <tbody>
          {waiters.map(w => (
            <tr key={w.name} style={TR_BODY}>
              <td style={{ ...TD, fontWeight: w.status === 'active' ? 'bold' : 'normal' }}>{w.name}</td>
              <td style={{ ...TD, textAlign: 'center' }}>
                {statusDot(w.status)} {w.status === 'active' ? 'Actif' : w.status === 'break' ? 'Pause' : 'Absent'}
              </td>
              <td style={{ ...TD, textAlign: 'right', color: '#555' }}>{w.clientsServed}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={FOOTER}>Total servis ce step : <b>{totalServed}</b></div>
    </div>
  );
}

function ClientsContent({ scenario, step, value }: { scenario: string; step: number; value: number }) {
  const clients = generateClientDetails(scenario, step, value);
  const avgSat = clients.length > 0
    ? clients.reduce((a, c) => a + c.satisfaction, 0) / clients.length
    : 0;
  const waiting = clients.filter(c => c.status === 'waiting').length;
  const barW = Math.round(avgSat * 100);

  return (
    <div>
      <div style={{ maxHeight: 130, overflowY: 'auto', marginBottom: 6 }}>
        <table style={TBL}>
          <thead>
            <tr style={TR_HEAD}>
              <th style={{ ...TH, textAlign: 'left' }}>Client</th>
              <th style={{ ...TH, textAlign: 'right' }}>Arrivée</th>
              <th style={{ ...TH, textAlign: 'right' }}>Attente</th>
              <th style={{ ...TH, textAlign: 'center' }}>Satisf.</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.clientId} style={TR_BODY}>
                <td style={TD}>{c.clientId}</td>
                <td style={{ ...TD, textAlign: 'right', color: '#888' }}>S.{c.arrivalStep}</td>
                <td style={{ ...TD, textAlign: 'right', color: '#888' }}>{c.waitMinutes}m</td>
                <td style={{ ...TD, textAlign: 'center' }}>{c.emoji} {Math.round(c.satisfaction * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ borderTop: '1px solid #eee', paddingTop: 6, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ color: '#666' }}>Moy. satisfaction :</span>
          <b>{barW}%</b>
          <span style={{ fontSize: 14 }}>{satisfactionEmoji(avgSat)}</span>
        </div>
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
          <div style={{ width: `${barW}%`, height: '100%', background: avgSat >= 0.5 ? '#27ae60' : '#e74c3c', borderRadius: 4 }} />
        </div>
        <div style={{ color: '#666' }}>En attente : {waiting} / {clients.length}</div>
      </div>
    </div>
  );
}

function TablesContent({ scenario, step, value }: { scenario: string; step: number; value: number }) {
  const tables = generateTableDetails(scenario, step, value);
  const occupied = tables.filter(t => t.status === 'occupied').length;
  const totalSeats = tables.reduce((a, t) => a + t.seats, 0);
  const seatedCount = tables.filter(t => t.status === 'occupied').reduce((a, t) => a + t.seats, 0);
  const rows = [tables.slice(0, 3), tables.slice(3, 6), tables.slice(6, 9), tables.slice(9, 12)];

  const bgFor = (s: string) =>
    s === 'occupied' ? '#fdecea' : s === 'reserved' ? '#fef9e7' : s === 'maintenance' ? '#f5f5f5' : '#eafaf1';

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
        {rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: 5 }}>
            {row.map(t => (
              <div key={t.tableId} style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '3px 4px', textAlign: 'center', background: bgFor(t.status), fontSize: 10 }}>
                <div style={{ fontWeight: 'bold', color: '#333' }}>{t.tableId}</div>
                <div style={{ fontSize: 13 }}>{statusDot(t.status)}</div>
                <div style={{ color: '#888' }}>{t.seats}p</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #eee', paddingTop: 6, fontSize: 11, color: '#555' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 4, fontSize: 10 }}>
          <span>🟢 Libre</span><span>🔴 Occupée</span><span>🟡 Réservée</span><span>⚫ HS</span>
        </div>
        Occupées : <b>{occupied}/12</b> | Places : <b>{seatedCount}/{totalSeats}</b>
      </div>
    </div>
  );
}

function ServedContent({ scenario, step, value }: { scenario: string; step: number; value: number }) {
  const sampleCount = Math.min(20, Math.max(5, Math.round(value / 3)));
  const clients = generateClientDetails(scenario, step, sampleCount);
  const avgSat = clients.length > 0
    ? clients.reduce((a, c) => a + c.satisfaction, 0) / clients.length
    : 0;
  const barW = Math.round(avgSat * 100);
  const debit = step > 0 ? (value / step).toFixed(1) : '—';
  const pct = (n: number) => clients.length > 0 ? Math.round(n / clients.length * 100) : 0;
  const groups = [
    { emoji: '😊', label: 'Très satisfait (>80%)', n: clients.filter(c => c.satisfaction >= 0.8).length },
    { emoji: '😐', label: 'Satisfait (50–80%)',    n: clients.filter(c => c.satisfaction >= 0.5 && c.satisfaction < 0.8).length },
    { emoji: '😟', label: 'Mécontent (20–50%)',    n: clients.filter(c => c.satisfaction >= 0.2 && c.satisfaction < 0.5).length },
    { emoji: '😡', label: 'Très mécontent (<20%)', n: clients.filter(c => c.satisfaction < 0.2).length },
  ];

  return (
    <div style={{ fontSize: 11 }}>
      <div style={{ marginBottom: 8, color: '#555' }}>
        <div>Clients servis total : <b>{Math.round(value)}</b></div>
        <div>Débit : <b>{debit} clients/step</b></div>
      </div>
      <div style={{ borderTop: '1px solid #eee', paddingTop: 6, marginBottom: 8 }}>
        <div style={{ color: '#666', marginBottom: 4, fontWeight: 'bold' }}>Satisfaction globale :</div>
        {groups.map(g => (
          <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <span style={{ width: 18 }}>{g.emoji}</span>
            <span style={{ flex: 1, color: '#555', fontSize: 10 }}>{g.label}</span>
            <span style={{ fontWeight: 'bold' }}>{g.n}</span>
            <span style={{ color: '#999', minWidth: 32 }}>({pct(g.n)}%)</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 10, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${barW}%`, height: '100%', background: avgSat >= 0.5 ? '#27ae60' : '#e74c3c', borderRadius: 4 }} />
          </div>
          <span style={{ fontWeight: 'bold', minWidth: 32 }}>{barW}%</span>
          <span style={{ fontSize: 14 }}>{satisfactionEmoji(avgSat)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── PopupContent ─────────────────────────────────────────────────────────

interface PopupContentProps {
  station: StationConfig;
  scenario: string;
  step: number;
  stepIdx: number;
  sparklineValues: number[];
  currentValue: number;
  stats: { min: number; max: number; avg: number };
  onClose: () => void;
}

function PopupContent({
  station, scenario, step, stepIdx, sparklineValues, currentValue, stats, onClose,
}: PopupContentProps) {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, borderBottom: '2px solid #f0f0f0', paddingBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{station.icon}</span>
        <span style={{ fontWeight: 'bold', fontSize: 13, color: '#2c3e50', flex: 1 }}>{station.label}</span>
        <span style={{ fontSize: 11, color: '#888', marginRight: 4 }}>Step {step}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', padding: '1px 7px', fontSize: 14, color: '#888', lineHeight: 1.3 }}
        >
          ×
        </button>
      </div>

      {/* Sparkline + stats */}
      <div style={{ marginBottom: 10 }}>
        <Sparkline values={sparklineValues} currentIdx={stepIdx} width={261} height={56} />
        <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#888', marginTop: 4 }}>
          <span>Min: <b style={{ color: '#e74c3c' }}>{Math.round(stats.min)}</b></span>
          <span>Max: <b style={{ color: '#27ae60' }}>{Math.round(stats.max)}</b></span>
          <span>Moy: <b style={{ color: '#3498db' }}>{stats.avg}</b></span>
          <span style={{ marginLeft: 'auto', color: '#2c3e50', fontWeight: 'bold' }}>▶ {Math.round(currentValue)}</span>
        </div>
      </div>

      {/* Contextual content */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
        {station.id === 'StockProbe'    && <StockContent   scenario={scenario} step={step} value={currentValue} />}
        {station.id === 'BarProbe'      && <PrepContent    scenario={scenario} step={step} value={currentValue} />}
        {station.id === 'WaiterProbe'   && <WaitersContent scenario={scenario} step={step} value={currentValue} />}
        {station.id === 'CustomerProbe' && <ClientsContent scenario={scenario} step={step} value={currentValue} />}
        {station.id === 'TableProbe'    && <TablesContent  scenario={scenario} step={step} value={currentValue} />}
        {station.id === 'ServedProbe'   && <ServedContent  scenario={scenario} step={step} value={currentValue} />}
      </div>
    </div>
  );
}



// ─── SatisfactionBar ──────────────────────────────────────────────────────

interface SatisfactionBarProps {
  avgSat: number;
  deltaSat: number;
  groups: { veryHappy: number; happy: number; unhappy: number; veryUnhappy: number };
  total: number;
}

function SatisfactionBar({ avgSat, deltaSat, groups, total }: SatisfactionBarProps) {
  const pct = Math.round(avgSat * 100);
  const pctColor = pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';
  const bg = pct >= 70 ? '#eafaf1' : pct >= 50 ? '#fef9e7' : '#fdecea';
  const borderColor = pct >= 70 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';

  const arrow = deltaSat > 0.01 ? '▲' : deltaSat < -0.01 ? '▼' : '─';
  const arrowColor = deltaSat > 0.01 ? '#27ae60' : deltaSat < -0.01 ? '#e74c3c' : '#999';
  const deltaAbs = Math.round(Math.abs(deltaSat) * 100);
  const deltaText = deltaSat > 0.01 ? `(+${deltaAbs}%)`
    : deltaSat < -0.01 ? `(−${deltaAbs}%)`
    : '(=)';

  const safeTotal = total || 1;
  const segs = [
    { w: groups.veryHappy   / safeTotal * 100, color: '#27ae60', emoji: '😊' },
    { w: groups.happy       / safeTotal * 100, color: '#f39c12', emoji: '😐' },
    { w: groups.unhappy     / safeTotal * 100, color: '#e67e22', emoji: '😟' },
    { w: groups.veryUnhappy / safeTotal * 100, color: '#e74c3c', emoji: '😡' },
  ];

  return (
    <div style={{
      padding: '5px 14px 6px',
      background: bg,
      borderLeft: `3px solid ${borderColor}`,
      flexShrink: 0,
      fontFamily: "'Segoe UI', Arial, sans-serif",
    }}>
      {/* Ligne 1 — label + score + tendance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{satisfactionEmoji(avgSat)}</span>
        <span style={{ fontSize: 11, color: '#666', fontWeight: 'bold' }}>Satisfaction globale</span>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: pctColor, marginLeft: 'auto' }}>{pct}%</span>
        <span style={{ fontSize: 11, color: arrowColor, fontWeight: 'bold' }}>{arrow}</span>
        <span style={{ fontSize: 10, color: arrowColor }}>{deltaText}</span>
      </div>
      {/* Ligne 2 — barre segmentée */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: '#e0e0e0', marginBottom: 4 }}>
        {segs.filter(s => s.w > 0).map(s => (
          <div
            key={s.emoji}
            style={{ width: `${s.w}%`, height: '100%', background: s.color, transition: 'width 0.4s ease' }}
          />
        ))}
      </div>
      {/* Ligne 3 — légende compacte */}
      <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
        {segs.map(s => (
          <span key={s.emoji}>{s.emoji} <b style={{ color: s.color }}>{Math.round(s.w)}%</b></span>
        ))}
      </div>
    </div>
  );
}

// ─── StationCard ──────────────────────────────────────────────────────────

interface StationCardProps {
  config: StationConfig;
  value: number;
  onClick: () => void;
  selected: boolean;
}

function StationCard({ config, value, onClick, selected }: StationCardProps) {
  const pct = config.maxCapacity > 0 ? Math.min(1, value / config.maxCapacity) : 0;
  const color = statusColor(pct);
  const gaugeW = Math.round(pct * (CARD_W - 24));
  const isLow = pct < 0.2;

  return (
    <g transform={`translate(${config.x},${config.y})`} onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Shadow */}
      <rect x={4} y={4} width={CARD_W} height={CARD_H} rx={12} fill="rgba(0,0,0,0.12)" />
      {/* Selection ring */}
      {selected && (
        <rect x={-3} y={-3} width={CARD_W + 6} height={CARD_H + 6} rx={14} fill="none" stroke="#3498db" strokeWidth={3} opacity={0.8} />
      )}
      {/* Card */}
      <rect width={CARD_W} height={CARD_H} rx={12} fill="white" stroke={selected ? '#3498db' : '#dee2e6'} strokeWidth={selected ? 2 : 1.5} />

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
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scenarios.length > 0 && !scenario) setScenario(scenarios[0]);
  }, [scenarios, scenario]);

  // Click outside to close popup
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectedStation(null);
      }
    }
    if (selectedStation) {
      document.addEventListener('mousedown', onOutside);
      return () => document.removeEventListener('mousedown', onOutside);
    }
    return undefined;
  }, [selectedStation]);

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

  // Popup: sparkline values + stats for selected station
  const popupSparklineValues = useMemo(() => {
    if (!selectedStation) return [] as number[];
    const scenarioData = dataMap.get(scenario);
    if (!scenarioData) return [] as number[];
    return steps.map(s => scenarioData.get(s)?.get(selectedStation) ?? 0);
  }, [selectedStation, scenario, dataMap, steps]);

  const popupStats = useMemo(() => {
    if (popupSparklineValues.length === 0) return { min: 0, max: 0, avg: 0 };
    const min = Math.min(...popupSparklineValues);
    const max = Math.max(...popupSparklineValues);
    const avg = +(popupSparklineValues.reduce((a, b) => a + b, 0) / popupSparklineValues.length).toFixed(1);
    return { min, max, avg };
  }, [popupSparklineValues]);

  const popupStation = useMemo(
    () => (selectedStation ? stations.find(s => s.id === selectedStation) ?? null : null),
    [selectedStation, stations],
  );

  // Satisfaction bar data
  const satisfactionData = useMemo(() => {
    const customerCount = currentValues['CustomerProbe'] ?? 0;
    if (customerCount <= 0) return null;
    const clients = generateClientDetails(scenario, currentStep ?? 0, customerCount);
    if (clients.length === 0) return null;
    const total = clients.length;
    const avgSat = clients.reduce((a, c) => a + c.satisfaction, 0) / total;
    const prevStep = steps[Math.max(0, stepIdx - 1)];
    const prevCount = dataMap.get(scenario)?.get(prevStep)?.get('CustomerProbe') ?? 0;
    const prevClients = generateClientDetails(scenario, prevStep ?? 0, prevCount);
    const prevAvgSat = prevClients.length > 0
      ? prevClients.reduce((a, c) => a + c.satisfaction, 0) / prevClients.length : 0;
    return {
      avgSat,
      deltaSat: avgSat - prevAvgSat,
      groups: {
        veryHappy:   clients.filter(c => c.satisfaction >= 0.8).length,
        happy:       clients.filter(c => c.satisfaction >= 0.5 && c.satisfaction < 0.8).length,
        unhappy:     clients.filter(c => c.satisfaction >= 0.2 && c.satisfaction < 0.5).length,
        veryUnhappy: clients.filter(c => c.satisfaction < 0.2).length,
      },
      total,
    };
  }, [scenario, currentStep, currentValues, steps, stepIdx, dataMap]);

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
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'visible' }}>
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
              onClick={() => setSelectedStation(s.id === selectedStation ? null : s.id)}
              selected={s.id === selectedStation}
            />
          ))}
        </svg>

        {/* Detail popup */}
        {popupStation && (
          <div ref={popupRef} style={getPopupStyle(popupStation)}>
            <PopupContent
              station={popupStation}
              scenario={scenario}
              step={currentStep ?? 0}
              stepIdx={stepIdx}
              sparklineValues={popupSparklineValues}
              currentValue={currentValues[popupStation.id] ?? 0}
              stats={popupStats}
              onClose={() => setSelectedStation(null)}
            />
          </div>
        )}
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

      {/* ── Satisfaction bar ─────────────────────────────────── */}
      {satisfactionData && (
        <SatisfactionBar
          avgSat={satisfactionData.avgSat}
          deltaSat={satisfactionData.deltaSat}
          groups={satisfactionData.groups}
          total={satisfactionData.total}
        />
      )}

    </div>
  );
}
