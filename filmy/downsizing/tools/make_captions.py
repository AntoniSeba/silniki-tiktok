"""Napisy słowo w słowo: czasy z transkrypcji, tekst poprawiony według skryptu."""
import json, re
w = json.load(open('assets/transcript.json'))
FIX = {'chwile': 'chwilę', 'Ridesiding.': 'Rightsizing.', 'Tylko,': 'Tylko', 'Uczciwie,': 'Uczciwie?', 'YouTube.': 'YouTubie.', 'Ty': 'ty', 'Ty.': 'ty.'}
SPLIT = {'autosportowe.': ['auto', 'sportowe.'], 'Wmieście,': ['W', 'mieście,'], 'paliwo-nachłodzenie,': ['paliwo', 'na', 'chłodzenie,']}
words = []
for x in w:
    t, s, e = x['text'], x['start'], x['end']
    if s >= 168.3:  # podsumowanie wycięte, film urywa się po "Link w bio"
        break
    if t in SPLIT:
        parts = SPLIT[t]
        tot = sum(len(p) for p in parts)
        c = s
        for p in parts:
            words.append((p, round(c, 3)))
            c += (e - s) * len(p) / tot
    else:
        words.append((FIX.get(t, t), round(s, 3)))
groups, cur = [], []
for i, (t, s) in enumerate(words):
    cur.append([t, s])
    chars = sum(len(a) for a, _ in cur) + len(cur) - 1
    nxt = words[i + 1][0] if i + 1 < len(words) else ''
    if re.search(r'[.,?!:]$', t) or len(cur) >= 3 or chars + 1 + len(nxt) > 17:
        groups.append(cur); cur = []
if cur: groups.append(cur)
out = []
for i, g in enumerate(groups):
    t0 = 0.0 if i == 0 else g[0][1]
    t1 = groups[i + 1][0][1] if i + 1 < len(groups) else 999
    out.append({'t0': t0, 't1': t1, 'w': g})
open('film/captions.js', 'w').write('// wygenerowane przez tools/make_captions.py\nexport const CAPS = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(len(words), 'słów,', len(out), 'grup')
print(' | '.join(' '.join(a for a, _ in g['w']) for g in out[:25]))
print(max(len(' '.join(a for a, _ in g['w'])) for g in out), 'max znaków')
