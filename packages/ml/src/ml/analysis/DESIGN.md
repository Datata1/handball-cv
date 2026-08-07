# Spielzugerkennung — Design (HWCP-153/154/155)

Regelbasierte Erkennung von Handball-Spielzügen aus den Top-View-Koordinaten
der Homographie-Pipeline (`players.court_x/court_y`, Feld 40×20 m, Tore bei
x=0 und x=40, Mittellinie x=20).

## Datenrealität (bestimmt das Design)

Analyse der `matches.duckdb` (Juni 2026):

| Eigenschaft | Befund | Konsequenz |
|---|---|---|
| Track-IDs | ~1000 Tracks für 14 Spieler in 2 min; Tracks reißen nach Sekunden ab | keine stabilen Identitäten → nur kurze, lokale Muster aus 1–2 Fragmenten erkennbar |
| Team-Labels | pro Frame vergeben, flackern innerhalb eines Tracks | Mehrheitsentscheid pro Segment |
| `velocity_x/y` | praktisch unbefüllt (≈0) | Geschwindigkeiten aus geglätteten Positionen ableiten |
| `has_ball` | nur bei manchen Matches gesetzt | Angriffsrichtung/-team heuristisch aus Positionsclustern |
| Framerate | 30 fps (`testvideo2min`) bis Stride 2 (~15 fps, `stuttgart_loewen_2026`) | alle Schwellwerte zeitbasiert (s, m, m/s), nie framebasiert |
| `matches`-Tabelle | die besten Datensätze sind Waisen (kein `matches`-Eintrag) | `wels-plays`-CLI mit fps-Fallback aus `frames.timestamp_s` |

## Warum regelbasiert und nicht DTW (HWCP-155 AK)

Der frühere DTW-Ansatz (CV-POC) wird **begründet verworfen**:

1. DTW aligniert vollständige Trajektorien gegen Referenz-Templates. Die
   Daten liefern aber nur Sekunden-Fragmente ohne Rollenzuordnung — es gibt
   nichts Stabiles zu alignieren.
2. Es existieren keine gelabelten Referenz-Spielzüge, aus denen Templates
   gebaut werden könnten.
3. Geometrische Prädikate (Abstände, Geschwindigkeiten, Zonen) sind für
   Trainer erklärbar („zwei Spieler kreuzen mit ≥1,2 m/s im Rückraum") und
   pro Spielzug einzeln justierbar.

DTW bleibt eine Option als *Verfeinerung* auf bereits erkannten, validierten
Eventfenstern (z. B. zur Unterscheidung Kreuzen vs. Parallelstoß).

## Erkannte Spielzüge (HWCP-154)

Alle Schwellwerte stehen als Konstanten am Kopf von `plays.py`.

### 1. Kreuzen / Positionstausch (`kreuzen`)
Zwei Fragmente desselben angreifenden Teams tauschen ihre laterale
(y-)Reihenfolge. Erfasst **beide Varianten** (Unterscheidung in
`details["variante"]`):

- **Scheren-Kreuzen** (`"kreuzen"`): beide laufen ≥1,2 m/s gegenläufig und
  passieren sich in ≤2,5 m → höhere Konfidenz.
- **Sequenzieller Tausch / Hinterlaufen** (`"positionswechsel"`): einer räumt
  seine Position, der Mitspieler läuft dahinter ein. Es gibt keinen Moment, in
  dem beide schnell gegenläufig sind — daher genügt *ein* laufender Spieler
  (≥1,0 m/s).

Gegen Jitter-Fehlalarme sichern stattdessen: klare Separation **vor und nach**
dem Reihenfolge-Flip (≥1,5 m innerhalb ±2 s), Vorbeilauf-Abstand ≤4 m
(Tiefenversatz beim Hinterlaufen erlaubt), beide im Band 4–17 m vorm Tor, und
beide müssen sich im Eventfenster netto ≥1 m bewegt haben (ein Läufer, der an
einem *stehenden* Mitspieler vorbeizieht, ist kein Tausch). Pro Paar werden
**alle** Flips gemeldet (Re-Arm 1 s).

### 2. Einläufer (`einlaeufer`)
Ein Fragment des angreifenden Teams verringert seinen Torabstand innerhalb
≤5 s überwiegend monoton (≥70 % fallende Schritte) von >9,5 m auf <7,5 m
(Netto-Annäherung ≥3 m) und bleibt danach ≥1 s in Kreisnähe (<8,5 m, verankert
am tiefsten Punkt → Finten zählen nicht). Startabstand ≤17 m verhindert, dass
ein Gegenstoß-Sprint als Einläufer zählt.

### 3. Parallelstoß (`parallelstoss`)
Zwei lateral benachbarte Rückraumspieler (Abstand 1,5–8 m, **ohne**
Reihenfolge-Tausch) des angreifenden Teams gewinnen beide innerhalb ≤2,5 s
mindestens 2 m Richtung Tor (Spitzentempo ≥1,2 m/s, Start im Band 7–17 m) —
„Druck machen". Drei stoßende Spieler ergeben mehrere Paar-Events, die
`merge_events` zu einem Event mit allen Tracks zusammenfasst.

### 4. Tempogegenstoß (`tempogegenstoss`)
Der Mannschafts-Schwerpunkt (≥3 gemappte Spieler) bewegt sich anhaltend mit
≥2 m/s Richtung gegnerisches Tor, Netto-Verschiebung ≥12 m in ≤10 s, Start in
der eigenen Hälfte, Ende klar jenseits der Mittellinie. Arbeitet auf
Schwerpunkten statt Einzeltracks → immun gegen Track-Fragmentierung.

**Nicht gewählt:** Sperren/Absetzen (braucht Körperkontakt-Information),
Jugo/Überzieher (lange Kombinationen, brauchen stabile Identitäten und
Ballverfolgung), Kempa (Ball-Flugbahn nötig).

## Wann beginnt und endet ein Spielzug?

Eventgrenzen kommen aus den **Bewegungsphasen** der Beteiligten, nicht aus
festen Fenstern um den Auslösemoment: Ein Spielzug beginnt, wenn der erste
beteiligte Spieler seine (nahezu) stehende Position verlässt
(Rückwärtssuche entlang der Geschwindigkeit bis <0,8 m/s), und endet, wenn
alle Beteiligten wieder zur Ruhe kommen (Vorwärtssuche), jeweils gekappt bei
3 s (`_movement_start_idx` / `_movement_end_idx`). Dauerläufer ziehen das
Fenster also nicht beliebig auf, und langsame Vorbereitungsschritte vor einem
Kreuzen gehören mit zum Event.

## Robustheit gegen Tracking-Artefakte

- **Fragment-Stitching** (`_stitch_fragments`): ByteTrack vergibt laufend neue
  IDs; ein Lauf eines Spielers verteilt sich auf mehrere Track-IDs — und der
  Reihenfolge-Flip eines Tauschs fällt gern genau auf eine Bruchstelle.
  Fragmente werden zusammengefügt, wenn eines ≤0,7 s nach dem Ende eines
  anderen nahe dessen letzter Position beginnt (Distanzbudget wächst mit der
  Lücke, hart gekappt bei 2,5 m, Team-Label muss kompatibel sein). Konkurrieren
  zwei Ketten ohne klaren Distanzsieger (<0,8 m Unterschied), wird **nicht**
  gestitcht — eine falsche Verbindung würde Identitäten tauschen.
- **Kontext-Persistenz**: Die Angriffsrichtungs-Heuristik (Abwehr kompakt am
  Kreis, Angriff weiter draußen) kollabiert systematisch, sobald der Angriff
  tief eindringt — die Angreifer stehen dann *zwischen* den Abwehrspielern
  (gemessen am 10-s-Clip: Margin fällt von 2,7 m auf 0,2–1,0 m und kippt
  einzeln sogar das Team). Deshalb bleibt ein etablierter Kontext bestehen,
  solange das Cluster am selben Tor steht; ein Teamwechsel am selben Tor
  braucht ≥2 aufeinanderfolgende Bins klarer Gegen-Evidenz.

## Angriffskontext-Heuristik

`infer_attack_contexts()` bestimmt pro 1-s-Bin, welches Tor angegriffen wird
und von wem — ohne `has_ball`:

- Beim Positionsangriff stehen *beide* Teams nahe einem Tor (Median-x aller
  Spieler <14 m bzw. >26 m).
- Die Abwehr steht kompakt am 6-m-Raum, der Angriff weiter draußen → das Team
  mit dem **größeren** mittleren Torabstand greift an (Margin ≥1 m).
- In Übergangsphasen gibt es keinen Kontext; Kreuzen nutzt dann einen lokalen
  Fallback (nächstes Tor + ≥2 Verteidiger zwischen Kreuzern und Tor),
  Einläufer wird ohne Kontext nicht gemeldet (zu hohe Verwechslungsgefahr).

## Architektur & Datenfluss

```
players (DuckDB) ──SQL (scoring.py / cli_plays.py)──▶ rows-Dicts
    ──▶ ml.analysis.plays.detect_plays()   (pure: Segmente → Kontexte → 3 Detektoren → Merge)
    ──▶ play_events (DuckDB)
    ──▶ backend GET /api/v1/matches/{id}/plays, /play-summary
    ──▶ Frontend-Tab „Angriff“ (Karten → Szenenliste → Videoplayer + Mini-Feld)
```

- `ml/analysis/plays.py` — pure functions, testbar ohne DB/GPU
  (`tests/test_plays.py`, synthetische Trajektorien).
- `ml/storage/schema.py` — Tabelle `play_events`; `details` enthält
  herunter­gesampelte Trajektorien (`[[t,x,y],…]`) für die Feldvisualisierung
  im Frontend (Schwerpunkt-Pfad mit `track_id = -1`).
- `ml/scoring.py` — Schritt 4 des `MatchScorer` (einziger DB-Schreiber).
- `ml/cli_plays.py` (`wels-plays <match_id>`) — Spielzugerkennung einzeln
  ausführen; toleriert fehlende `matches`-Einträge.
- Duplikate durch Track-Brüche (derselbe reale Spielzug unter mehreren
  Track-Paaren) werden zeitlich gemerged (`merge_events`, Gap ≤1 s).

## Validierung gegen Ground Truth: 10-Sekunden-Clip (`cdf6f8f2`, 2026-06-12)

Vom Trainer beschriebener Spielzug (4 Aktionen) vs. Erkennung nach dem Umbau
(Positionstausch-Generalisierung, Stitching, Kontext-Persistenz, Parallelstoß):

| # | Ground Truth | Erkannt? |
|---|---|---|
| 1 | RM ↔ RL tauschen die Positionen (zu Beginn) | ❌ **datenbedingt nicht erkennbar**: Court-Koordinaten beginnen erst bei Frame 118 (~3,9 s) — die Homographie liefert in den ersten 4 s nichts (Ingestion-Problem, nicht Detektor-Logik) |
| 2 | Halb rechts läuft ein Richtung Kreis/links unten | ✓ `einlaeufer` 00:04–00:13 (0.70) |
| 3 | Halb rechts + Mitte stoßen Richtung Tor („Druck") | ✓ `parallelstoss` 00:08–00:15 (0.72) |
| 4 | Halb links läuft hinter der Mitte ein (Tausch) | ✓ `kreuzen`/`positionswechsel` 00:13–00:15 (0.95) — brauchte Stitching (Läufer = Tracks 322→387→438) und Kontext-Persistenz |

Vor dem Umbau wurde nur #2 erkannt; #1 bleibt offen, bis die Homographie vom
ersten Frame an liefert.

## Validierung (HWCP-156)

Vorgehen: `wels-plays testvideo2min` und `wels-plays stuttgart_loewen_2026`
ausführen, Events im Frontend-Tab „Angriff“ gegen die Videoszene prüfen.
Ergebnisse (True/False-Positives pro Typ, Schwellwert-Empfehlungen) hier
ergänzen.

### Erste Ergebnisse (automatischer Lauf, 2026-06-12 — manuelle Video-Prüfung ausstehend)

- `testvideo2min` (2:14 min, 30 fps): **11 Events** — 5 Kreuzen, 5 Einläufer,
  1 Tempogegenstoß. Plausible Dichte (~5 Events/min im Positionsangriff).
- `stuttgart_loewen_2026` (7:09 min, Stride 2): **23 Events** — 10 Kreuzen,
  9 Einläufer, 4 Tempogegenstöße. Detektoren funktionieren also auch bei
  halbierter Framerate.

Beobachtungen aus der Entwicklung (bereits behoben):

1. *Doppelter Tempogegenstoß:* Beim Konter sprinten beide Teams — der
   Schwerpunkt allein unterscheidet Konter nicht von Rückzug. Fix: Das Team
   muss im Angriffskontext kurz nach dem Lauf (≤4 s) das angreifende Team am
   Ziel-Tor sein (`_is_attacking_after`).
2. *Centroid-Sprünge:* Wechselnde Track-Besetzung (Spieler betreten/verlassen
   das Bild) ließ den Schwerpunkt >8 m/s „springen“ → 1-s-Phantom-Gegenstöße.
   Fix: Obergrenze `_BREAK_MAX_SPEED = 7 m/s` (schneller als Sprint = Artefakt).
3. *Finten beim Einläufer:* Haltephase wird seit dem Fix am *tiefsten* Punkt
   des Laufs verankert, nicht am ersten Unterschreiten der Schwelle.

Bekannte offene Punkte für die manuelle Prüfung:

- Bei `stuttgart_loewen_2026` 00:57 wird Kreuzen für *beide* Teams gemeldet —
  während einer Übergangsphase (kein Kontext) greift der lokale Fallback, und
  Verteidiger, die den Kreuzern folgen, kreuzen selbst. Kandidat für eine
  strengere Fallback-Regel, falls die Videoprüfung das als False Positive
  bestätigt.
- Kreuzen bei 00:00–00:01 (`testvideo2min`) beginnt am Videoanfang —
  Glättungs-/Randeffekt möglich.

## Bekannte Grenzen

- Kein Ballbezug: ein „Kreuzen“ ohne Ball (Freilaufen) ist vom echten Kreuzen
  nicht unterscheidbar.
- Erfolgsquote pro Spielzug (Mock-UI zeigte sie) ist ohne Tor-/Wurfzuordnung
  nicht bestimmbar — bewusst weggelassen statt erfunden.
- Die Angriffskontext-Heuristik versagt bei leerem Feld-Drittel (Kamera-Zoom)
  und in Auszeiten; Events außerhalb eines Kontexts werden konservativ
  unterdrückt (Precision vor Recall).
