const fs = require('fs');
const path = require('path');

const applyFix = (file, replacer) => {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return;
  let txt = fs.readFileSync(p, 'utf-8');
  const orig = txt;
  
  txt = replacer(txt);
  
  // Add missing DailyEntry import if it uses it
  if (txt.includes('DailyEntry') && !txt.includes('import type { DailyEntry') && !txt.includes('import { DailyEntry')) {
      const depth = file.split('/').length - 2;
      const rel = depth === 1 ? '../types' : '../../types';
      if (txt.includes('import type {')) {
          txt = txt.replace(/import type {([^}]+)} from '..\/types'/, "import type { $1, DailyEntry } from '../types'");
      } else {
          txt = `import type { DailyEntry } from '${rel}';\n` + txt;
      }
  }
  
  // Add missing DayBlock
  if (txt.includes('DayBlock') && !txt.includes('DayBlock') && txt.includes('import type { ')) {
      txt = txt.replace(/import type {([^}]+)} from '..\/types'/, "import type { $1, DayBlock } from '../types'");
  }

  if (txt !== orig) {
     fs.writeFileSync(p, txt);
     console.log('Fixed:', file);
  }
};

applyFix('src/components/AutoDayOverlay.tsx', (t) => {
  let text = t;
  text = text.replace(/find\(t =>/g, "find((t: TemplateDefinition) =>");
  return text;
});

applyFix('src/components/DayBuilder.tsx', (t) => {
  let text = t;
  text = text.replace(/map\(b => b\.title\)/g, "map((b: DayBlock) => b.title)");
  if (!text.includes('DayBlock,') && !text.includes('DayBlock }')) {
     text = `import type { DayBlock } from '../types';\n` + text;
  }
  return text;
});

applyFix('src/pages/Analytics.tsx', t => t); // Just needs import
applyFix('src/pages/Reports.tsx', t => t);   // Just needs import
applyFix('src/pages/Timeline.tsx', t => t);  // Just needs import

applyFix('src/pages/Daily.tsx', (t) => {
  let text = t;
  text = text.replace(/map\(\(_, i\) =>/g, "map((_: any, i: number) =>");
  text = text.replace(/map\(\(block, index\) =>/g, "map((block: DayBlock, index: number) =>");
  return text;
});

applyFix('src/stores/dailyStore.ts', (t) => {
  let text = t;
  text = text.replace(/create<DailyStore>\(\)/g, "create<DailyState>()");
  text = text.replace(/set\(\(state\) =>/g, "set((state: DailyState) =>");
  text = text.replace(/set\(\(s\) =>/g, "set((s: DailyState) =>");
  text = text.replace(/\(t\) => t\.id/g, "(t: TemplateDefinition) => t.id");
  text = text.replace(/find\(t =>/g, "find((t: TemplateDefinition) =>");
  text = text.replace(/filter\(t =>/g, "filter((t: TemplateDefinition) =>");
  return text;
});

applyFix('src/utils/exportUtils.ts', (t) => {
  let text = t;
  // Convert explicit typings inside exports
  text = text.replace(/filter\(e =>/g, "filter((e: DailyEntry) =>");
  text = text.replace(/sort\(\(a, b\) =>/g, "sort((a: DailyEntry, b: DailyEntry) =>");
  text = text.replace(/map\(e =>/g, "map((e: DailyEntry) =>");
  text = text.replace(/reduce\(\(s, e\) =>/g, "reduce((s: number, e: DailyEntry) =>");
  return text;
});
