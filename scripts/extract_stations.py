
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

        region_map = {
            '北京': '华北', '天津': '华北', '河北': '华北', '山西': '华北', '内蒙古': '华北',
            '辽宁': '东北', '吉林': '东北', '黑龙江': '东北',
            '上海': '华东', '江苏': '华东', '浙江': '华东', '安徽': '华东', '福建': '华东', '江西': '华东', '山东': '华东',
            '河南': '华中', '湖北': '华中', '湖南': '华中',
            '广东': '华南', '广西': '华南', '海南': '华南',
            '重庆': '西南', '四川': '西南', '贵州': '西南', '云南': '西南', '西藏': '西南',
            '陕西': '西北', '甘肃': '西北', '青海': '西北', '宁夏': '西北', '新疆': '西北',
            '香港': '华南', '澳门': '华南', '台湾': '华东',
        }
        region = region_map.get(province, '中国')
        code = (rec[1] or '').strip() if rec[1] else None
        if code and len(code) > 10:
            code = None

        stations.append({
            'name': name, 'code': code if code else None,
            'city': city, 'country': '中国', 'region': region,
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
            region_map = {
                'BJ': '华北', 'TJ': '华北', 'HE': '华北', 'SX': '华北', 'NM': '华北',
                'LN': '东北', 'JL': '东北', 'HL': '东北',
                'SH': '华东', 'JS': '华东', 'ZJ': '华东', 'AH': '华东', 'FJ': '华东', 'JX': '华东', 'SD': '华东',
                'HA': '华中', 'HB': '华中', 'HN': '华中',
                'GD': '华南', 'GX': '华南', 'HI': '华南',
                'CQ': '西南', 'SC': '西南', 'GZ': '西南', 'YN': '西南', 'XZ': '西南',
                'SN': '西北', 'GS': '西北', 'QH': '西北', 'NX': '西北', 'XJ': '西北',
                'HK': '华南', 'MO': '华南', 'TW': '华东',
            }
            region = region_map.get(region_code, '中国')
            airports.append({
                'name': name, 'code': iata if iata else None,
                'city': city, 'country': '中国', 'region': region,
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
