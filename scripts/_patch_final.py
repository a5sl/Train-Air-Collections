import sys
sys.stdout.reconfigure(encoding='utf-8')
f = r'D:\Learn_coding\Train-Air-Collections\client\src\pages\TripList.tsx'
with open(f, 'r', encoding='utf-8') as fh:
    lines = fh.readlines()

content = ''.join(lines)
changes = []

# === BUG-3: sort with departureTime respecting sortOrder ===
old_sort = "    .sort((a, b) => { const da = parseDate(a.departureDate); const db = parseDate(b.departureDate); return sortOrder === 'desc' ? db - da : da - db; });"
new_sort = """    .sort((a, b) => {
      const da = parseDate(a.departureDate); const db = parseDate(b.departureDate);
      if (da !== db) return sortOrder === 'desc' ? db - da : da - db;
      const ta = a.departureTime || ''; const tb = b.departureTime || '';
      return sortOrder === 'desc' ? tb.localeCompare(ta) : ta.localeCompare(tb);
    });"""
if old_sort in content:
    content = content.replace(old_sort, new_sort)
    changes.append('BUG-3: sort fix')
else:
    print('WARNING: sort pattern not found, checking...')
    # try to find the line
    for i, line in enumerate(lines):
        if '.sort((a, b)' in line and 'parseDate' in line:
            print(f'  Found at line {i+1}: {line.rstrip()}')

# === opt-2: save scroll on edit click ===
old_edit = "onClick={() => navigate('/edit/' + trip.id)}"
new_edit = "onClick={() => { sessionStorage.setItem('tripScroll', String(window.scrollY)); sessionStorage.setItem('tripEditId', String(trip.id)); navigate('/edit/' + trip.id); }}"
if old_edit in content:
    content = content.replace(old_edit, new_edit)
    changes.append('opt-2: save scroll on edit')
else:
    print('WARNING: edit onClick not found')

# === opt-2: add id to trip card ===
old_card = "<div className={'card p-4 group transition-all hover:shadow-md hover:-translate-y-0.5' + (tearingId === trip.id ? ' tearing' : '')}>"
new_card = "<div id={'trip-card-' + trip.id} className={'card p-4 group transition-all hover:shadow-md hover:-translate-y-0.5' + (tearingId === trip.id ? ' tearing' : '')}>"
if old_card in content:
    content = content.replace(old_card, new_card)
    changes.append('opt-2: card id')
else:
    print('WARNING: card div not found')

# === opt-2: scroll restore useEffect ===
old_effect = '  useEffect(() => { loadTrips(); }, []);'
new_effect = """  useEffect(() => { loadTrips(); }, []);

  // Restore scroll position after returning from edit
  useEffect(() => {
    if (!loading) {
      const editId = sessionStorage.getItem('tripEditId');
      if (editId) {
        sessionStorage.removeItem('tripEditId');
        sessionStorage.removeItem('tripScroll');
        requestAnimationFrame(() => {
          document.getElementById('trip-card-' + editId)?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        });
      }
    }
  }, [loading]);"""
if old_effect in content:
    content = content.replace(old_effect, new_effect)
    changes.append('opt-2: scroll restore')
else:
    print('WARNING: loadTrips useEffect not found')

with open(f, 'w', encoding='utf-8') as fh:
    fh.write(content)
print(f'Applied: {", ".join(changes)}')
