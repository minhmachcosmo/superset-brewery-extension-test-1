"""
generate_brewery_data.py
Generates simulation_stock.db with 6 probes x 24 steps x 3 scenarios = 432 rows.
Schema is identical to V1: Simulation_run, Probe_instance, Probe_run, StockMeasure, csm_run_id, run_name
"""
import sqlite3
import math
import os

STEPS = 24

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

# ─── Reference Scenario ──────────────────────────────────────────────────────

def gen_reference():
    stock, bar, waiter, table_, customer, served_list = [], [], [], [], [], []
    s = 50
    served = 0
    for i in range(STEPS):
        s = max(0, s - 2)
        if i == 12:
            s = min(50, s + 20)
        stock.append(round(s, 1))

        bar.append(clamp(round(8 + 4 * math.sin(i * 0.4) - (2 if 10 <= i <= 13 else 0)), 2, 15))
        waiter.append(clamp(round(2 + 3 * math.exp(-((i - 9) ** 2) / 20)), 1, 5))
        table_.append(clamp(round(2 + 10 * math.exp(-((i - 9) ** 2) / 28)), 1, 12))
        customer.append(clamp(round(5 + 22 * math.exp(-((i - 8) ** 2) / 22)), 2, 30))
        served += waiter[-1] * 2
        served_list.append(min(100, served))

    return {
        'StockProbe': stock,
        'BarProbe': bar,
        'WaiterProbe': waiter,
        'TableProbe': table_,
        'CustomerProbe': customer,
        'ServedProbe': served_list,
    }

# ─── PROD Scenario (fast depletion, no resupply) ─────────────────────────────

def gen_prod():
    stock, bar, waiter, table_, customer, served_list = [], [], [], [], [], []
    s = 50
    served = 0
    for i in range(STEPS):
        depletion = 4 if i < 10 else 3
        s = max(0, s - depletion)
        stock.append(round(s, 1))

        bar.append(clamp(round(s * 0.25 + 1), 0, 15))
        waiter.append(clamp(round(1 + 4 * (s / 50)), 0, 5))
        table_.append(clamp(round(2 + 9 * math.exp(-((i - 5) ** 2) / 12)), 0, 12))
        customer.append(clamp(round(4 + 20 * math.exp(-((i - 5) ** 2) / 12)), 0, 30))
        served += waiter[-1] * 2
        served_list.append(min(100, served))

    return {
        'StockProbe': stock,
        'BarProbe': bar,
        'WaiterProbe': waiter,
        'TableProbe': table_,
        'CustomerProbe': customer,
        'ServedProbe': served_list,
    }

# ─── TestSuperset2 (doubled affluence from step 8) ───────────────────────────

def gen_test():
    stock, bar, waiter, table_, customer, served_list = [], [], [], [], [], []
    s = 50
    served = 0
    for i in range(STEPS):
        if i == 14:
            s = min(50, s + 18)
        depletion = 2 if i < 8 else 4
        s = max(0, s - depletion)
        stock.append(round(s, 1))

        penalty = -5 if stock[-1] < 8 else 0
        base = 8 if i >= 8 else 6
        bar.append(clamp(round(base + penalty + 2 * math.sin(i * 0.5)), 0, 15))

        waiter.append(clamp(round(2 + (3 if i >= 8 else 2 * math.exp(-((i - 8) ** 2) / 15))), 1, 5))

        if i < 8:
            table_.append(clamp(round(2 + 5 * math.exp(-((i - 8) ** 2) / 20)), 1, 12))
        else:
            table_.append(clamp(round(10 + 2 * math.sin(i * 0.7)), 8, 12))

        if i < 8:
            customer.append(clamp(round(5 + 18 * math.exp(-((i - 8) ** 2) / 25)), 2, 30))
        else:
            customer.append(clamp(round(25 + 5 * math.sin(i * 0.6)), 18, 30))

        rate = waiter[-1] * (3 if i >= 8 else 2)
        served += rate
        served_list.append(min(100, served))

    return {
        'StockProbe': stock,
        'BarProbe': bar,
        'WaiterProbe': waiter,
        'TableProbe': table_,
        'CustomerProbe': customer,
        'ServedProbe': served_list,
    }

# ─── Write to SQLite ──────────────────────────────────────────────────────────

db_path = os.path.join(os.path.dirname(__file__), 'simulation_stock.db')
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.execute('DROP TABLE IF EXISTS stock_simulation')
cur.execute('''
    CREATE TABLE stock_simulation (
        Simulation_run TEXT,
        Probe_instance TEXT,
        Probe_run      INTEGER,
        StockMeasure   REAL,
        csm_run_id     TEXT,
        run_name       TEXT
    )
''')

scenarios = [
    ('run-mr5l0lgnk1k9', 'ReferenceScenario',        gen_reference()),
    ('run-o6kgpq357v5m', 'PROD-15427-UpdatedDataset', gen_prod()),
    ('run-9nw7yvq90meq', 'TestSuperset2',             gen_test()),
]

rows = []
probes = ['StockProbe', 'BarProbe', 'WaiterProbe', 'TableProbe', 'CustomerProbe', 'ServedProbe']

for run_id, run_name, data in scenarios:
    for probe in probes:
        values = data[probe]
        for step, val in enumerate(values):
            rows.append((run_id, probe, step, val, run_id, run_name))

cur.executemany('INSERT INTO stock_simulation VALUES (?,?,?,?,?,?)', rows)
conn.commit()
conn.close()

print(f"Generated {len(rows)} rows  ({len(scenarios)} scenarios x {len(probes)} probes x {STEPS} steps)")
print()
for run_id, run_name, data in scenarios:
    print(f"  {run_name}")
    for probe in probes:
        vals = data[probe]
        print(f"    {probe:20s}: {vals[:5]}  ...  {vals[-3:]}")
    print()
