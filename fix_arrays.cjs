const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/Analytics.tsx',
  'src/pages/Daily.tsx',
  'src/pages/Reports.tsx',
  'src/pages/Timeline.tsx',
  'src/utils/exportUtils.ts',
  'src/components/AutoDayOverlay.tsx',
  'src/components/DayBuilder.tsx',
  'src/stores/dailyStore.ts'
];

files.forEach(f => {
  const p = path.join(__dirname, f);
  if (!fs.existsSync(p)) return;
  let txt = fs.readFileSync(p, 'utf-8');
  let orig = txt;

  // 1. Cast Object.values(entries)
  txt = txt.replace(/Object\.values\(entries\)/g, '(Object.values(entries) as DailyEntry[])');
  txt = txt.replace(/Object\.values\(get\(\)\.entries\)/g, '(Object.values(get().entries) as DailyEntry[])');

  // 2. Fix 't' implicitly any in AutoDayOverlay
  if (f.includes('AutoDayOverlay')) {
    txt = txt.replace(/find\(\(t\) => t\.systemType === newSys\)/g, 'find((t: TemplateDefinition) => t.systemType === newSys)');
    txt = txt.replace(/find\(t => t\.systemType === newSys\)/g, 'find((t: TemplateDefinition) => t.systemType === newSys)');
  }

  // 3. Fix 'b' implicitly any in DayBuilder
  if (f.includes('DayBuilder')) {
    txt = txt.replace(/filter\(b => b\.type === 'deep_work'\)/g, "filter((b: DayBlock) => b.type === 'deep_work')");
    txt = txt.replace(/filter\(\(b\) => b\.type === 'deep_work'\)/g, "filter((b: DayBlock) => b.type === 'deep_work')");
  }

  // 4. Fix block, index in Daily.tsx
  if (f.includes('Daily.tsx')) {
    txt = txt.replace(/map\(\(block, index\) => \(/g, "map((block: DayBlock, index: number) => (");
    txt = txt.replace(/map\(\(_, i\) => \(/g, "map((_: any, i: number) => (");
  }

  // Double casting cleanup
  txt = txt.replace(/\(\(Object\.values\(entries\) as DailyEntry\[\]\) as DailyEntry\[\]\)/g, '(Object.values(entries) as DailyEntry[])');

  if (txt !== orig) {
     if(!txt.includes('import type {') && !txt.includes('import {') && f.includes('pages')) {
         txt = `import type { DailyEntry } from '../types';\n` + txt;
     } else if (!txt.includes('DailyEntry') && f.includes('pages')) {
         txt = txt.replace(/} from '\.\.\/types'/, ', DailyEntry } from \'../types\'');
     }
     fs.writeFileSync(p, txt);
     console.log('Fixed:', f);
  }
});
