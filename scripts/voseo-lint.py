#!/usr/bin/env python3
# Detecta voseo rioplatense en textos en español (tuteo chileno esperado).
# Uso: python3 voseo-lint.py archivo [archivo...]   → lista línea y forma; sale con 1 si encuentra algo.
import re, sys
L = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ'
# Formas inequívocas (pronombre, presente voseante, imperativos voseantes frecuentes).
FORMAS = r'''vos|tenés|podés|querés|sabés|sos|hacés|decís|ponés|venís|salís|vivís|sentís|entendés|conocés|creés|pensás|necesitás|buscás|usás|mirás|
agregá|mirá|fijate|acordate|hacé|decí|poné|andá|vení|sacá|tomá|dejá|probá|revisá|mandá|usá|pensá|buscá|contá|cerrá|elegí|escribí|corré|armá|agotá|
preguntale|mandale|pasale|ponele|contale|decile|avisale|fijáte|metele|pegale|
che|laburo|laburar|boludo|quilombo|pibe|piba|bárbaro|dale'''
formas = '|'.join(p.strip() for p in FORMAS.replace('\n','').split('|') if p.strip())
# Para los imperativos terminados en í (elegí, escribí, pedí...) hay que descartar el pretérito en primera persona:
# solo cuentan si van seguidos de un objeto directo típico de imperativo. Los excluimos del patrón y los revisamos aparte.
AMBIGUAS = {'escribí', 'elegí', 'pedí', 'corré', 'abrí', 'subí', 'leí'}
# Una forma entre comillas angulares («tenés») es una mención, no un uso: la regla misma las cita.
pat = re.compile(rf'(?<![{L}«])({formas})(?![{L}»])', re.I)
total = 0
for path in sys.argv[1:]:
    with open(path, encoding='utf-8') as f:
        for n, line in enumerate(f, 1):
            for m in pat.finditer(line):
                w = m.group(1).lower()
                if w in AMBIGUAS:
                    continue
                total += 1
                print(f'{path}:{n}: «{w}»  {line.strip()[:110]}')
print(f'-- {total} forma(s) voseante(s)', file=sys.stderr)
sys.exit(1 if total else 0)
