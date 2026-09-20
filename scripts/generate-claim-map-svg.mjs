// Generates public/claim-map.svg: the dot-matrix world map with the claim
// heat baked in. Serving it as an <img> keeps ~1600 SVG elements out of the
// homepage's HTML (agents and the content ratio both care), while /stats
// keeps the interactive DOM version.
//
// Heat is recounted from the live registry through the same geoPlacement the
// stats page uses, so this image can never drift behind the page's own
// numbers the way the generated snapshot once did. Runs as a prebuild step;
// the committed copy is just the latest output.
import { writeFileSync } from 'node:fs';
import { DOTMAP } from '../app/components/dotmap-data.js';
import { CLAIM_GEO } from '../app/components/claim-geo.js';
import countryCentroids from './country-centroids.json' with { type: 'json' };
import { readRegistry } from '../lib/registry-files.js';
import { geoPlacement } from '../lib/geo-placement.js';

const PITCH = 10;
const DOT_R = 2.2;
const COLS = DOTMAP.cols;
const NROWS = DOTMAP.rows.length;

// Same projection the map component uses, over the same placement the stats
// page renders: claim-time country first, geocode enrichment second.
const { points } = geoPlacement(readRegistry(), CLAIM_GEO, countryCentroids);

const w = COLS * PITCH;
const h = NROWS * PITCH;

let base = '';
DOTMAP.rows.forEach((line, r) => {
  for (let c = 0; c < COLS; c++) {
    if (line[c] === '1') {
      base += `<circle cx="${c * PITCH + PITCH / 2}" cy="${r * PITCH + PITCH / 2}" r="${DOT_R}"/>`;
    }
  }
});

let heat = '';
// Per-claim blooms, geometrically identical to the selection overlay in
// app/components/home-map.jsx: a wide faint halo plus a bright core at each
// claim coordinate. The earlier version bucketed claims into grid cells and
// drew one bloom per cell, which read noticeably sparser than the overlay
// and made the resting map look like it was hiding the real heat.
for (const [lat, lon] of Object.values(points)) {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(((lon + 180) / 360) * COLS)));
  const r = Math.min(NROWS - 1, Math.max(0, Math.floor(((84 - lat) / 140) * NROWS)));
  const x = c * PITCH + PITCH / 2;
  const y = r * PITCH + PITCH / 2;
  heat += `<circle cx="${x}" cy="${y}" r="${DOT_R + 5}" fill-opacity="0.22"/>`;
  heat += `<circle cx="${x}" cy="${y}" r="3.2" fill-opacity="0.9"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Dot-matrix world map; brighter dots mark where runs-on.dev names are claimed">
<g fill="#f3f3f3" fill-opacity="0.45">${base}</g>
<g fill="#4d7cff">${heat}</g>
</svg>
`;

writeFileSync('public/claim-map.svg', svg);
console.log(`wrote public/claim-map.svg (${(svg.length / 1024).toFixed(1)} KB, ${Object.keys(points).length} claims plotted)`);
