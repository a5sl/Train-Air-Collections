#!/usr/bin/env python3
"""
Phase 1: Download raw seed data from authoritative sources.
  - 12306 for Chinese train stations
  Run: python3 scripts/refresh_seed.py
"""
import json, re, sys, os, urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(ROOT, "server", "src", "db")

def ts_escape(s):
    return json.dumps(s, ensure_ascii=False)

def format_station(s):
    code = "null" if s.get("code") is None else ts_escape(s["code"])
    lat = s.get("lat") or s.get("latitude")
    lng = s.get("lng") or s.get("longitude")
    lat_s = "null" if lat is None else str(lat)
    lng_s = "null" if lng is None else str(lng)
    return (f'  {{ name:{ts_escape(s["name"])}, code:{code}, '
            f'city:{ts_escape(s["city"])}, country:{ts_escape(s["country"])}, '
            f'lat:{lat_s}, lng:{lng_s}, type:{ts_escape(s["type"])} }}')

def write_ts_file(filename, const_name, items, comment):
    path = os.path.join(OUT_DIR, filename)
    lines = [f"// {comment}", f"export const {const_name} = ["]
    for i, item in enumerate(items):
        comma = "," if i < len(items) - 1 else ","
        lines.append(format_station(item) + comma)
    lines.append("];\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  Wrote {len(items)} entries → {filename}")

# ---- 12306 Chinese train stations ----
def fetch_12306():
    url = "https://kyfw.12306.cn/otn/resources/js/framework/station_name.js"
    print("Fetching 12306 station data...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
    except Exception as e:
        print(f"  ERROR: {e}")
        return None

    m = re.search(r"station_names\s*=\s*'([^']*)'", raw)
    if not m:
        print("  ERROR: Could not parse 12306 response")
        return None

    data = m.group(1)
    stations = []
    seen = set()

    for entry in data.split("@"):
        if not entry.strip():
            continue
        parts = entry.split("|")
        if len(parts) < 8:
            continue
        name = parts[1].strip()
        code = parts[2].strip() or None
        city = parts[7].strip()

        key = f"{name}|{city}"
        if key in seen:
            continue
        seen.add(key)

        stations.append({
            "name": name,
            "code": code if code else None,
            "city": city if city else name,
            "country": "中国",
            "lat": None,
            "lng": None,
            "type": "train_station",
        })

    print(f"  12306: {len(stations)} stations (deduped)")
    return stations

# ---- International rail (curated static list) ----
INTL_RAIL = [
    # Japan
    {"name":"東京駅", "code":None, "city":"東京", "country":"日本", "lat":35.6812, "lng":139.7671, "type":"train_station"},
    {"name":"新大阪駅", "code":None, "city":"大阪", "country":"日本", "lat":34.7332, "lng":135.5004, "type":"train_station"},
    {"name":"京都駅", "code":None, "city":"京都", "country":"日本", "lat":34.9858, "lng":135.7587, "type":"train_station"},
    {"name":"博多駅", "code":None, "city":"福岡", "country":"日本", "lat":33.5902, "lng":130.4206, "type":"train_station"},
    {"name":"名古屋駅", "code":None, "city":"名古屋", "country":"日本", "lat":35.1709, "lng":136.8815, "type":"train_station"},
    {"name":"札幌駅", "code":None, "city":"札幌", "country":"日本", "lat":43.0687, "lng":141.3508, "type":"train_station"},
    {"name":"仙台駅", "code":None, "city":"仙台", "country":"日本", "lat":38.2603, "lng":140.8823, "type":"train_station"},
    {"name":"広島駅", "code":None, "city":"広島", "country":"日本", "lat":34.3976, "lng":132.4757, "type":"train_station"},
    # South Korea
    {"name":"서울역", "code":None, "city":"서울", "country":"韩国", "lat":37.5547, "lng":126.9707, "type":"train_station"},
    {"name":"부산역", "code":None, "city":"부산", "country":"韩国", "lat":35.1152, "lng":129.0414, "type":"train_station"},
    # Europe
    {"name":"Gare du Nord", "code":None, "city":"Paris", "country":"法国", "lat":48.8809, "lng":2.3553, "type":"train_station"},
    {"name":"Gare de Lyon", "code":None, "city":"Paris", "country":"法国", "lat":48.8448, "lng":2.3735, "type":"train_station"},
    {"name":"St Pancras International", "code":"SPX", "city":"London", "country":"英国", "lat":51.5314, "lng":-0.1262, "type":"train_station"},
    {"name":"Berlin Hbf", "code":None, "city":"Berlin", "country":"德国", "lat":52.5256, "lng":13.3694, "type":"train_station"},
    {"name":"Milano Centrale", "code":None, "city":"Milano", "country":"意大利", "lat":45.4859, "lng":9.2048, "type":"train_station"},
    {"name":"Roma Termini", "code":None, "city":"Roma", "country":"意大利", "lat":41.9009, "lng":12.5024, "type":"train_station"},
    {"name":"Wien Hbf", "code":None, "city":"Wien", "country":"奥地利", "lat":48.1853, "lng":16.3745, "type":"train_station"},
    {"name":"Moskva Kazansky", "code":None, "city":"莫斯科", "country":"俄罗斯", "lat":55.7736, "lng":37.6559, "type":"train_station"},
    # SE Asia
    {"name":"Hanoi Station", "code":None, "city":"Hà Nội", "country":"越南", "lat":21.0245, "lng":105.8412, "type":"train_station"},
    {"name":"Bangkok Hua Lamphong", "code":None, "city":"Bangkok", "country":"泰国", "lat":13.7385, "lng":100.5167, "type":"train_station"},
    {"name":"Kuala Lumpur Sentral", "code":None, "city":"Kuala Lumpur", "country":"马来西亚", "lat":3.1343, "lng":101.6869, "type":"train_station"},
    # HK/TW
    {"name":"香港西九龍站", "code":"XJA", "city":"香港", "country":"中国香港", "lat":22.3036, "lng":114.1657, "type":"train_station"},
    {"name":"台北車站", "code":None, "city":"台北", "country":"中国台湾", "lat":25.0478, "lng":121.5170, "type":"train_station"},
    # Americas
    {"name":"Grand Central Terminal", "code":None, "city":"New York", "country":"美国", "lat":40.7527, "lng":-73.9772, "type":"train_station"},
]

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    cn_rail = fetch_12306()
    if cn_rail is None:
        print("12306 unavailable — keeping existing rail data")
        return
    write_ts_file("seed-china-rail.ts", "chinaRailStations", cn_rail,
                  "==== CHINA RAILWAY STATIONS (from 12306) ====")
    write_ts_file("seed-intl-rail.ts", "intlRailStations", INTL_RAIL,
                  "==== INTERNATIONAL RAIL STATIONS ====")
    print("\nPhase 1 done. Run: python3 scripts/build_seed.py")

if __name__ == "__main__":
    main()
