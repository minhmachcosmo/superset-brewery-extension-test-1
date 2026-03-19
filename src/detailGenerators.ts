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
import {
  ClientDetail,
  WaiterDetail,
  TableDetail,
  StockItemDetail,
  OrderDetail,
} from './types';

// ─── PRNG (mulberry32) ──────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 9999;
}

function makePRNG(scenario: string, step: number, salt: number): () => number {
  const seed = (hashString(scenario) * 10000 + step * 100 + salt) | 0;
  return mulberry32(seed);
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PRODUCTS = ['Blonde IPA', 'Stout', 'Pilsner', 'Wheat Beer', 'Porter', 'Lager'];
const WAITER_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
const TABLE_SEATS = [2, 4, 2, 6, 2, 4, 4, 2, 4, 2, 6, 4]; // T1–T12
const MAX_PER_PRODUCT = [15, 12, 10, 10, 8, 8];

// ─── Satisfaction helper ─────────────────────────────────────────────────────

export function satisfactionEmoji(sat: number): string {
  if (sat >= 0.8) return '😊';
  if (sat >= 0.5) return '😐';
  if (sat >= 0.2) return '😟';
  return '😡';
}

// ─── Generators ──────────────────────────────────────────────────────────────

export function generateClientDetails(
  scenario: string,
  step: number,
  count: number,
): ClientDetail[] {
  const rng = makePRNG(scenario, step, 1);
  const safeCount = Math.max(0, Math.round(count));
  const statuses: ClientDetail['status'][] = ['waiting', 'seated', 'served'];

  return Array.from({ length: safeCount }, (_, i) => {
    const arrivalStep = Math.max(0, step - Math.floor(rng() * 12));
    const waitMinutes = Math.round(rng() * 140) / 10; // 0.0–14.0
    const satisfaction = Math.max(0, Math.round((1.0 - waitMinutes * 0.08) * 100) / 100);
    const roll = rng();
    const status = roll < 0.5 ? statuses[0] : roll < 0.85 ? statuses[1] : statuses[2];
    return {
      clientId: `Client #${i + 1}`,
      arrivalStep,
      waitMinutes,
      satisfaction,
      status,
      emoji: satisfactionEmoji(satisfaction),
    };
  });
}

export function generateWaiterDetails(
  scenario: string,
  step: number,
  activeCount: number,
): WaiterDetail[] {
  const rng = makePRNG(scenario, step, 2);
  const clamped = Math.max(0, Math.min(5, Math.round(activeCount)));

  // Fisher-Yates shuffle to pick which waiters are active
  const indices = [0, 1, 2, 3, 4];
  for (let i = 4; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const activeSet = new Set(indices.slice(0, clamped));

  return WAITER_NAMES.map((name, i) => {
    const isActive = activeSet.has(i);
    const status: WaiterDetail['status'] = isActive ? 'active' : rng() < 0.5 ? 'break' : 'off';
    const clientsServed = isActive
      ? Math.round(rng() * 8 + step * 0.8)
      : Math.round(rng() * 4);
    return { name, status, clientsServed };
  });
}

export function generateTableDetails(
  scenario: string,
  step: number,
  occupiedCount: number,
): TableDetail[] {
  const rng = makePRNG(scenario, step, 3);
  // Index 8 = T9 is always maintenance
  const available = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11];
  const clamped = Math.max(0, Math.min(available.length, Math.round(occupiedCount)));

  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const occupiedSet = new Set(shuffled.slice(0, clamped));
  const reservedCount = Math.floor(rng() * 2);
  const reservedSet = new Set(shuffled.slice(clamped, clamped + reservedCount));

  return TABLE_SEATS.map((seats, i) => {
    let status: TableDetail['status'];
    if (i === 8) {
      status = 'maintenance';
    } else if (occupiedSet.has(i)) {
      status = 'occupied';
    } else if (reservedSet.has(i)) {
      status = 'reserved';
    } else {
      status = 'free';
    }
    return { tableId: `T${i + 1}`, seats, status };
  });
}

export function generateStockItemDetails(
  scenario: string,
  step: number,
  totalStock: number,
): StockItemDetail[] {
  const rng = makePRNG(scenario, step, 4);
  const total = Math.max(0, Math.round(totalStock));

  // Distribute total across products using random weights
  const weights = PRODUCTS.map(() => 0.5 + rng() * 0.5);
  const sumW = weights.reduce((a, b) => a + b, 0);
  const quantities: number[] = new Array(6).fill(0);
  let remaining = total;

  for (let i = 0; i < PRODUCTS.length - 1; i++) {
    const q = Math.min(MAX_PER_PRODUCT[i], Math.max(0, Math.round(total * weights[i] / sumW)));
    quantities[i] = q;
    remaining -= q;
  }
  quantities[5] = Math.max(0, Math.min(MAX_PER_PRODUCT[5], remaining));

  return PRODUCTS.map((productName, i) => {
    const quantity = quantities[i];
    const maxQuantity = MAX_PER_PRODUCT[i];
    const pct = maxQuantity > 0 ? quantity / maxQuantity : 0;
    const status: StockItemDetail['status'] = pct >= 0.5 ? 'ok' : pct >= 0.2 ? 'low' : 'critical';
    return { productName, quantity, maxQuantity, status };
  });
}

export function generateOrderDetails(
  scenario: string,
  step: number,
  barCount: number,
): OrderDetail[] {
  const rng = makePRNG(scenario, step, 5);
  const safeCount = Math.max(0, Math.round(barCount));
  const baseId = step * 10 + hashString(scenario) % 90 + 1;
  const statuses: OrderDetail['status'][] = ['ready', 'preparing', 'waiting'];

  return Array.from({ length: safeCount }, (_, i) => ({
    orderId: `CMD-${String(baseId + i).padStart(3, '0')}`,
    productName: PRODUCTS[Math.floor(rng() * PRODUCTS.length)],
    status: statuses[Math.floor(rng() * 3)],
    durationMin: Math.round((1 + rng() * 4) * 10) / 10,
  }));
}
