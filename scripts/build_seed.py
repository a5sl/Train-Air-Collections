#!/usr/bin/env python3
"""
Phase 2: Download airports (OurAirports) and airlines (OpenFlights),
generate TypeScript seed files, and rebuild seed.db.
  Run: python3 scripts/build_seed.py
"""
import csv, io, json, os, re, sqlite3, urllib.request, sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(ROOT, "server", "src", "db")
DATA_DIR = os.path.join(ROOT, "server", "data")
SEED_DB = os.path.join(DATA_DIR, "seed.db")

def ts_escape(s):
    return json.dumps(s, ensure_ascii=False)

# ---- OurAirports ----
def fetch_ourairports():
    url = "https://davidmegginson.github.io/ourairports-data/airports.csv"
    print("Downloading OurAirports (this may take a minute)...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as e:
        print(f"  ERROR: {e}")
        return [], []

    reader = csv.DictReader(io.StringIO(raw))
    cn, intl = [], []
    for row in reader:
        atype = row.get("type", "")
        if atype not in ("large_airport", "medium_airport"):
            continue
        iata = (row.get("iata_code") or "").strip()
        if not iata:
            continue

        a = {
            "name": row["name"].strip(),
            "code": iata,
            "city": (row.get("municipality") or row.get("iso_region", "")).strip(),
            "country": (row.get("iso_country") or "").strip(),
            "lat": float(row["latitude_deg"]) if row.get("latitude_deg") and row["latitude_deg"].strip() else None,
            "lng": float(row["longitude_deg"]) if row.get("longitude_deg") and row["longitude_deg"].strip() else None,
            "type": "airport",
        }
        if a["country"] == "CN":
            cn.append(a)
        else:
            # Deduplicate by IATA code
            if not any(x["code"] == a["code"] for x in intl):
                intl.append(a)

    print(f"  Airports: {len(cn)} CN + {len(intl)} international")
    return cn, intl

# ---- OpenFlights airlines ----
def fetch_airlines():
    url = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat"
    print("Downloading OpenFlights airlines...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as e:
        print(f"  ERROR: {e}")
        return [], []

    airlines = []
    for line in raw.strip().split("\n"):
        parts = [p.strip('"').strip() for p in line.split(",")]
        if len(parts) < 8:
            continue
        _, name, _, iata, icao, _, country, active = parts[:8]
        if active != "Y":
            continue
        airlines.append({"name": name, "country": country})

    cn = [a for a in airlines if a["country"] == "China"]
    intl_countries = {"Japan", "South Korea", "Singapore", "Thailand", "Malaysia",
                      "Vietnam", "Indonesia", "Philippines", "United Kingdom",
                      "France", "Germany", "Netherlands", "Italy", "Switzerland",
                      "Austria", "Spain", "Russia", "India",
                      "Australia", "New Zealand", "United States", "Canada",
                      "United Arab Emirates", "Qatar", "Turkey",
                      "Hong Kong", "Taiwan", "Macau"}
    intl = [a for a in airlines if a["country"] in intl_countries]
    print(f"  Airlines: {len(cn)} CN + {len(intl)} international")
    return cn, intl

# ---- Output TypeScript files ----
def write_airports(filename, const_name, items, comment):
    path = os.path.join(OUT_DIR, filename)
    lines = [f"// {comment}", f"export const {const_name} = ["]
    for i, a in enumerate(items):
        comma = "," if i < len(items) - 1 else ","
        code = "null" if a["code"] is None else ts_escape(a["code"])
        lat = "null" if a["lat"] is None else str(a["lat"])
        lng = "null" if a["lng"] is None else str(a["lng"])
        lines.append(f'  {{ name:{ts_escape(a["name"])}, code:{code}, city:{ts_escape(a["city"])}, country:{ts_escape(a["country"])}, lat:{lat}, lng:{lng}, type:"airport" }}{comma}')
    lines.append("];\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  Wrote {len(items)} → {filename}")

def write_operators(rail_ops, airline_ops):
    operators = rail_ops + [{"name": a["name"], "type": "airline", "region": a["country"]} for a in airline_ops]
    path = os.path.join(OUT_DIR, "seed-operators.ts")
    lines = ["// ==== OPERATORS (railway bureaus + airlines) ====", "export const seedOperators = ["]
    for i, o in enumerate(operators):
        comma = "," if i < len(operators) - 1 else ","
        lines.append(f'  {{ name:{ts_escape(o["name"])}, type:{ts_escape(o["type"])}, region:{ts_escape(o["region"])} }}{comma}')
    lines.append("];\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  Wrote {len(operators)} → seed-operators.ts")

# ---- Build SQLite seed.db ----
def parse_ts_array(filepath):
    with open(filepath, encoding="utf-8") as f:
        content = f.read()
    objs = re.findall(
        r'\{\s*name:"([^"]*)",\s*code:(null|"[^"]*"),\s*city:"([^"]*)",\s*country:"([^"]*)",\s*lat:(null|[\d.\-]+),\s*lng:(null|[\d.\-]+),\s*type:"([^"]*)"\s*\}',
        content
    )
    results = []
    for name, code, city, country, lat, lng, stype in objs:
        results.append({
            "name": name,
            "code": None if code == "null" else code.strip('"'),
            "city": city,
            "country": country,
            "lat": None if lat == "null" else float(lat),
            "lng": None if lng == "null" else float(lng),
            "type": stype,
        })
    return results

def parse_ts_operators(filepath):
    with open(filepath, encoding="utf-8") as f:
        content = f.read()
    objs = re.findall(r'\{\s*name:"([^"]*)",\s*type:"([^"]*)"(?:,\s*region:"([^"]*)")?\s*\}', content)
    return [{"name": n, "type": t, "region": r if r else ""} for n, t, r in objs]

def rebuild_db():
    if os.path.exists(SEED_DB):
        os.remove(SEED_DB)

    db = sqlite3.connect(SEED_DB)
    db.execute("PRAGMA foreign_keys = ON")
    db.execute("""CREATE TABLE stations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT,
        city TEXT NOT NULL, country TEXT NOT NULL, latitude REAL, longitude REAL,
        type TEXT NOT NULL, timezone TEXT, created_at TEXT DEFAULT (datetime('now')) NOT NULL)""")
    db.execute("""CREATE TABLE operators (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT,
        type TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')) NOT NULL)""")

    now = "2026-07-24T00:00:00.000Z"
    total_stations = 0
    for fname in ["seed-china-rail.ts", "seed-china-air.ts", "seed-intl-air.ts", "seed-intl-rail.ts"]:
        fpath = os.path.join(OUT_DIR, fname)
        if not os.path.exists(fpath):
            continue
        stations = parse_ts_array(fpath)
        db.executemany(
            "INSERT INTO stations (name, code, city, country, latitude, longitude, type, timezone, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            [(s["name"], s["code"], s["city"], s["country"], s["lat"], s["lng"], s["type"], None, now) for s in stations]
        )
        total_stations += len(stations)

    ops_path = os.path.join(OUT_DIR, "seed-operators.ts")
    if os.path.exists(ops_path):
        operators = parse_ts_operators(ops_path)
        db.executemany(
            "INSERT INTO operators (name, code, type, created_at) VALUES (?,?,?,?)",
            [(o["name"], None, o["type"], now) for o in operators]
        )
    else:
        operators = []

    db.commit()
    db.close()
    size_kb = os.path.getsize(SEED_DB) / 1024
    print(f"\nseed.db rebuilt: {total_stations} stations, {len(operators)} operators ({size_kb:.0f} KB)")

# ---- Main ----
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    cn_air, intl_air = fetch_ourairports()
    if cn_air or intl_air:
        write_airports("seed-china-air.ts", "chinaAirports", cn_air, "==== CHINA AIRPORTS (from OurAirports) ====")
        write_airports("seed-intl-air.ts", "intlAirports", intl_air, "==== INTERNATIONAL AIRPORTS (from OurAirports) ====")

    cn_al, intl_al = fetch_airlines()

    rail_ops = [
        {"name": "中国国家铁路集团有限公司", "type": "railway", "region": "中国"},
        {"name": "中国铁路北京局集团有限公司", "type": "railway", "region": "北京"},
        {"name": "中国铁路上海局集团有限公司", "type": "railway", "region": "上海"},
        {"name": "中国铁路广州局集团有限公司", "type": "railway", "region": "广州"},
        {"name": "中国铁路成都局集团有限公司", "type": "railway", "region": "成都"},
        {"name": "中国铁路武汉局集团有限公司", "type": "railway", "region": "武汉"},
        {"name": "中国铁路西安局集团有限公司", "type": "railway", "region": "西安"},
        {"name": "中国铁路济南局集团有限公司", "type": "railway", "region": "济南"},
        {"name": "中国铁路沈阳局集团有限公司", "type": "railway", "region": "沈阳"},
        {"name": "中国铁路哈尔滨局集团有限公司", "type": "railway", "region": "哈尔滨"},
        {"name": "中国铁路呼和浩特局集团有限公司", "type": "railway", "region": "呼和浩特"},
        {"name": "中国铁路太原局集团有限公司", "type": "railway", "region": "太原"},
        {"name": "中国铁路郑州局集团有限公司", "type": "railway", "region": "郑州"},
        {"name": "中国铁路南昌局集团有限公司", "type": "railway", "region": "南昌"},
        {"name": "中国铁路兰州局集团有限公司", "type": "railway", "region": "兰州"},
        {"name": "中国铁路南宁局集团有限公司", "type": "railway", "region": "南宁"},
        {"name": "中国铁路昆明局集团有限公司", "type": "railway", "region": "昆明"},
        {"name": "中国铁路青藏集团有限公司", "type": "railway", "region": "西宁"},
        {"name": "中国铁路乌鲁木齐局集团有限公司", "type": "railway", "region": "乌鲁木齐"},
        {"name": "JR East", "type": "railway", "region": "日本"},
        {"name": "JR West", "type": "railway", "region": "日本"},
        {"name": "JR Central", "type": "railway", "region": "日本"},
        {"name": "Korail", "type": "railway", "region": "韩国"},
        {"name": "SNCF", "type": "railway", "region": "法国"},
        {"name": "Deutsche Bahn", "type": "railway", "region": "德国"},
        {"name": "Trenitalia", "type": "railway", "region": "意大利"},
        {"name": "Amtrak", "type": "railway", "region": "美国"},
        {"name": "Eurostar", "type": "railway", "region": "英国"},
        {"name": "RENFE", "type": "railway", "region": "西班牙"},
        {"name": "SBB CFF FFS", "type": "railway", "region": "瑞士"},
        {"name": "NS", "type": "railway", "region": "荷兰"},
        {"name": "ÖBB", "type": "railway", "region": "奥地利"},
        {"name": "РЖД", "type": "railway", "region": "俄罗斯"},
        {"name": "台灣高鐵", "type": "railway", "region": "中国台湾"},
        {"name": "港鐵 MTR", "type": "railway", "region": "中国香港"},
    ]
    write_operators(rail_ops, cn_al + intl_al)

    # Rebuild SQLite DB
    rebuild_db()
    print("\nAll done. Restart the server to load new seed.db.")

if __name__ == "__main__":
    main()
