import fs from "node:fs";

const layout = JSON.parse(
  fs.readFileSync(".cursor-import/figjam-layout-drillnet.json", "utf8")
);
const code = `
const L = ${JSON.stringify(layout)};
const h = (r, g, b) => ({ r: r / 255, g: g / 255, b: b / 255 });
const BLUE = h(0x00, 0x14, 0xdc);
const GRAY = h(0xa8, 0xda, 0xff);
const WHITE = h(0xff, 0xff, 0xff);

const probe = figma.createSticky();
await figma.loadFontAsync(probe.text.fontName);
probe.remove();

const mapSection = figma.createSection();
mapSection.name = L.title + ' · Map';
mapSection.fills = [{ type: 'SOLID', color: h(0xf2, 0xf2, 0xf7) }];
mapSection.x = 200;
mapSection.y = 200;
figma.currentPage.appendChild(mapSection);

const idMap = {};
const PAD = 32;

for (const n of L.nodes) {
  const s = figma.createSticky();
  await figma.loadFontAsync(s.text.fontName);
  s.text.characters = n.text;
  if (n.kind === 'root') {
    s.fills = [{ type: 'SOLID', color: GRAY }];
    if ('isWideWidth' in s) s.isWideWidth = true;
  } else {
    s.fills = [{ type: 'SOLID', color: WHITE }];
  }
  mapSection.appendChild(s);
  s.x = PAD + n.x;
  s.y = PAD + n.y;
  idMap[n.id] = s.id;
}

for (const e of L.laneEdges) {
  const from = idMap[e.from];
  const to = idMap[e.to];
  if (!from || !to) continue;
  const c = figma.createConnector();
  c.connectorStart = { endpointNodeId: from, magnet: 'RIGHT' };
  c.connectorEnd = { endpointNodeId: to, magnet: 'LEFT' };
  c.strokes = [{ type: 'SOLID', color: BLUE }];
  c.strokeWeight = 2;
  mapSection.appendChild(c);
}

for (const e of L.phaseEdges) {
  const from = idMap[e.from];
  const to = idMap[e.to];
  if (!from || !to) continue;
  const c = figma.createConnector();
  c.connectorStart = { endpointNodeId: from, magnet: 'RIGHT' };
  c.connectorEnd = { endpointNodeId: to, magnet: 'LEFT' };
  c.strokes = [{ type: 'SOLID', color: h(0x70, 0x75, 0x7a) }];
  c.strokeWeight = 2;
  mapSection.appendChild(c);
}

let maxX = 0, maxY = 0;
for (const child of mapSection.children) {
  if ('width' in child && 'height' in child) {
    maxX = Math.max(maxX, child.x + child.width);
    maxY = Math.max(maxY, child.y + child.height);
  }
}
mapSection.resize(maxX + PAD, maxY + PAD);

const ins = figma.createSection();
ins.name = L.title + ' · Insights';
ins.fills = [{ type: 'SOLID', color: h(0xf1, 0xf5, 0xf9) }];
ins.x = mapSection.x + mapSection.width + 80;
ins.y = mapSection.y;
figma.currentPage.appendChild(ins);

const t1 = figma.createText();
await figma.loadFontAsync({ family: 'Inter', style: 'Bold' });
t1.fontName = { family: 'Inter', style: 'Bold' };
t1.characters = 'Journey insights\\n' + L.insights.coverageLabel;
t1.fontSize = 14;
ins.appendChild(t1);
t1.x = 16; t1.y = 16;

const t2 = figma.createText();
await figma.loadFontAsync({ family: 'Inter', style: 'Medium' });
t2.fontName = { family: 'Inter', style: 'Medium' };
const k = L.insights.kpis;
t2.characters = 'Phases ' + k.phases + ' · Phase steps ' + k.steps + ' · User actions ' + k.actions;
t2.fontSize = 11;
ins.appendChild(t2);
t2.x = 16; t2.y = 52;

let hy = 96;
const hTitle = figma.createText();
hTitle.fontName = { family: 'Inter', style: 'Bold' };
hTitle.characters = 'Friction on map';
hTitle.fontSize = 11;
ins.appendChild(hTitle);
hTitle.x = 16; hTitle.y = hy;
hy += 24;

await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
for (const spot of L.insights.hotspots) {
  const st = figma.createSticky();
  await figma.loadFontAsync(st.text.fontName);
  st.text.characters = spot.severity + ' · ' + spot.phase + '\\n' + spot.snippet;
  st.fills = [{ type: 'SOLID', color: h(0xff, 0xe2, 0x99) }];
  ins.appendChild(st);
  st.x = 16;
  st.y = hy;
  hy += 110;
}
ins.resize(300, hy + 24);

return {
  mapSectionId: mapSection.id,
  insightsSectionId: ins.id,
  stickyCount: L.nodes.length,
  laneConnectors: L.laneEdges.length,
  phaseConnectors: L.phaseEdges.length,
  link: 'https://www.figma.com/board/L6ILRJHwSQdivEGcaIT3Bl/Test?node-id=' + mapSection.id.replace(':', '-'),
};
`;
fs.writeFileSync(".cursor-import/figjam-plugin-code.txt", code.trim(), "utf8");
console.log("bytes", code.length);