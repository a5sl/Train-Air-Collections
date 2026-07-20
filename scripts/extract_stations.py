
import shapefile
import csv
import json
import sys
import os

RAIL_AIRPORT_DIR = os.path.join(os.path.dirname(__file__), '..', 'rail_airport_stat')
SERVER_DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'server', 'data')

def extract_railway_stations():
    shp_path = os.path.join(RAIL_AIRPORT_DIR, 'railway_stations', '火车站')
    sf = shapefile.Reader(shp_path)
    records = sf.records()

    stations = []
    for rec in records:
        name = (rec[9] or rec[1] or '').strip()
        if not name:
            continue
        province = (rec[7] or '').strip()
        city = (rec[8] or '').strip()
        lng = rec[13]
        lat = rec[14]
        if not city:
            city = province if province else '未知'
        code = (rec[1] or '').strip() if rec[1] else None
        if code and len(code) > 10:
            code = None

        stations.append({
            'name': name, 'code': code if code else None,
            'city': city, 'country': '中国',
            'latitude': lat if lat else None,
            'longitude': lng if lng else None,
            'type': 'train_station',
        })

    seen = set()
    unique = []
    for s in stations:
        key = (s['name'], s['city'])
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique

def extract_airports():
    csv_path = os.path.join(RAIL_AIRPORT_DIR, 'airports', 'airports_cn.csv')
    airports = []
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('iso_country', '').strip() != 'CN':
                continue
            name = row.get('chinese_name', '').strip()
            if not name:
                name = row.get('name', '').strip()
            iata = (row.get('iata_code') or '').strip()
            try:
                lat = float(row['latitude_deg']) if row.get('latitude_deg') else None
            except (ValueError, TypeError):
                lat = None
            try:
                lng = float(row['longitude_deg']) if row.get('longitude_deg') else None
            except (ValueError, TypeError):
                lng = None
            municipality = (row.get('municipality') or '').strip()
            iso_region = (row.get('iso_region') or '').strip()
            city = municipality if municipality else '未知'
            region_code = iso_region.split('-')[-1] if '-' in iso_region else ''
            airports.append({
                'name': name, 'code': iata if iata else None,
                'city': city, 'country': '中国',
                'latitude': lat, 'longitude': lng, 'type': 'airport',
            })
    seen = set()
    unique = []
    for a in airports:
        if a['name'] not in seen:
            seen.add(a['name'])
            unique.append(a)
    return unique

def main():
    print('Extracting railway stations...')
    rail_stations = extract_railway_stations()
    print(f'  Found {len(rail_stations)} railway stations')
    print('Extracting airports...')
    airports = extract_airports()
    print(f'  Found {len(airports)} airports')
    all_stations = rail_stations + airports
    for i, s in enumerate(all_stations):
        s['id'] = i + 1
        s['createdAt'] = '2026-07-18T00:00:00.000Z'
    os.makedirs(SERVER_DATA_DIR, exist_ok=True)
    output_path = os.path.join(SERVER_DATA_DIR, 'stations.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_stations, f, ensure_ascii=False, indent=2)
    print(f'\nTotal stations: {len(all_stations)}')
    print(f'  Railway: {len(rail_stations)}')
    print(f'  Airports: {len(airports)}')
    print(f'Written: {output_path}')
    return 0

if __name__ == '__main__':
    sys.exit(main())
