# Handlungsraum

Handlungsraum ist als webbasierter Denk- und Bewegungsraum angelegt: eine ruhige, fortlaufende Konstruktion aus Text, Abstand, Drift und Relation. Das Projekt nimmt PDF-Dokumente nicht als bloße Datenquelle, sondern als Material für eine räumliche Typografie, in der Erfahrung, Praxis und soziale Formationen sichtbar werden.

Die Arbeit orientiert sich an drei Bezugspunkten:

- **John Dewey** – Kunst als Erfahrung
- **Georg W. Bertram** – Kunst als menschliche Praxis
- **Joseph Beuys** – Soziale Plastik

Statt einer futuristischen Partikelästhetik entsteht eine reduzierte architektonische Ordnung: Fragmente treten in Distanz, Linien verknüpfen gemeinsame Begriffe, gelbe Marker markieren relationale Verdichtungen. Weißraum bleibt dabei nicht Hintergrund, sondern aktiver Bestandteil des Systems.

## Konzept

Der Prototyp lädt PDF-Dateien aus `./pdf`, extrahiert Text über **PDF.js**, zerlegt ihn in lesbare Fragmente und legt diese als typografische Körper im Canvas ab. Ein langsames Bewegungssystem hält den Raum in beständiger Reorganisation. Parallel dazu werden wiederkehrende Begriffe erkannt und über die Wikipedia-Suche kontextualisiert. Wo Fragmente Begriffe teilen, entstehen relationale Linien und gelbe Markierungen. Die PDF.js-Builds liegen lokal im Repository, damit der Raum auch ohne externe CDN-Abhängigkeit lesbar bleibt.

Es handelt sich bewusst um ein stilles Interface:

- große negative Räume
- industrielle Grotesk-Typografie
- reduzierte Farbigkeit
- langsame, lesbare Bewegungen
- architektonische Raster ohne starre Symmetrie

## Ordnerstruktur

```text
.
├── README.md
├── index.html
├── style.css
├── app.js
├── js/
│   ├── modules/
│       ├── canvas-scene.js
│       ├── fragmenter.js
│       ├── layout-system.js
│       ├── motion-system.js
│       ├── pdf-loader.js
│       ├── typography-system.js
│       └── wikipedia.js
│   └── vendor/
│       ├── LICENSE-pdfjs-dist.txt
│       ├── pdf.min.mjs
│       └── pdf.worker.min.mjs
└── pdf/
    ├── manifest.json
    └── handlungsraum-sample.pdf
```

## Start

Da der Prototyp mit ES-Modulen und Fetch arbeitet, sollte er über einen kleinen lokalen Webserver geöffnet werden:

```bash
cd /home/runner/work/handlungsraumeins-/handlungsraumeins-
python3 -m http.server 8000
```

Danach im Browser öffnen:

```text
http://localhost:8000
```

## Funktionsweise

1. `pdf/manifest.json` definiert, welche PDFs automatisch geladen werden.
2. `pdf-loader.js` liest die PDFs mit PDF.js ein und extrahiert den Text.
3. `fragmenter.js` zerlegt den Text in räumlich brauchbare Einheiten.
4. `layout-system.js` verteilt die Fragmente in offenen Zonen mit viel Weißraum.
5. `motion-system.js` erzeugt langsame Drift und periodische Reorganisation.
6. `wikipedia.js` sucht zu geteilten Begriffen passende Wikipedia-Einträge.
7. `canvas-scene.js` zeichnet Typografie, Linien, Marker und räumliche Dynamik.

## Hinweise zur Erweiterung

- Weitere PDFs können direkt in `./pdf` abgelegt und im Manifest eingetragen werden.
- Alternativ lassen sich PDFs zur Laufzeit über das Interface hochladen.
- Das visuelle System ist bewusst modular gehalten, damit Typografie, Layout, Bewegungslogik und Relationen unabhängig weiterentwickelt werden können.

## Status

Diese erste Version versteht sich als funktionierender Prototyp: kein abgeschlossenes Produkt, sondern ein offener räumlicher Aufbauprozess.
