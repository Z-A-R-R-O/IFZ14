import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'src/pages/Analytics.tsx',
  'src/pages/Daily.tsx',
  'src/pages/Reports.tsx',
  'src/pages/Timeline.tsx',
  'src/utils/exportUtils.ts',
  'src/components/AutoDayOverlay.tsx',
  'src/components/DayBuilder.tsx',
  'src/pages/DayLab.tsx',
  'src/stores/dailyStore.ts'
];

filesToUpdate.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf-8');
  let original = content;

  // Replace implicitly typed 'e' arrays over Object.values(entries) with explicit types
  content = content.replace(/\.filter\(\(e: any\) =>/g, '.filter((e: DailyEntry) =>');
  content = content.replace(/\.filter\(e =>/g, '.filter((e: DailyEntry) =>');
  content = content.replace(/\.filter\(\(e\) =>/g, '.filter((e: DailyEntry) =>');
  
  content = content.replace(/\.sort\(\(a, b\) =>/g, '.sort((a: DailyEntry, b: DailyEntry) =>');
  content = content.replace(/\.sort\(\(a: any, b: any\) =>/g, '.sort((a: DailyEntry, b: DailyEntry) =>');

  content = content.replace(/\.map\(\(e\) =>/g, '.map((e: DailyEntry) =>');
  content = content.replace(/\.map\(e =>/g, '.map((e: DailyEntry) =>');
  content = content.replace(/\.map\(\(e: any\) =>/g, '.map((e: DailyEntry) =>');

  content = content.replace(/\.reduce\(\(s, e\) =>/g, '.reduce((s: number, e: DailyEntry) =>');
  content = content.replace(/\.reduce\(\(s: number, e: any\) =>/g, '.reduce((s: number, e: DailyEntry) =>');

  // DayBlock specific mapping
  content = content.replace(/\.filter\(\(b: any\) =>/g, '.filter((b: DayBlock) =>');
  content = content.replace(/\.filter\(\(b\) =>/g, '.filter((b: DayBlock) =>');
  content = content.replace(/\.filter\(b =>/g, '.filter((b: DayBlock) =>');
  
  content = content.replace(/\.reduce\(\(acc: number, b: any\) =>/g, '.reduce((acc: number, b: DayBlock) =>');
  content = content.replace(/\.reduce\(\(acc, b\) =>/g, '.reduce((acc: number, b: DayBlock) =>');

  content = content.replace(/\.some\(\(b: any\) =>/g, '.some((b: DayBlock) =>');
  content = content.replace(/\.some\(\(b\) =>/g, '.some((b: DayBlock) =>');
  content = content.replace(/\.some\(b =>/g, '.some((b: DayBlock) =>');
  
  content = content.replace(/\.forEach\(\(b: any, index: any\) =>/g, '.forEach((b: DayBlock, index: number) =>');
  content = content.replace(/\.forEach\(\(block, index\) =>/g, '.forEach((block: DayBlock, index: number) =>');
  
  // dailyStore specific
  if (file === 'src/stores/dailyStore.ts') {
      content = content.replace(/create<DailyStore>\(\)/g, "create<DailyState>()");
      
      // Also add explicit imports if missing
      if (!content.includes('DailyEntry')) {
         content = `import type { DailyEntry } from '../types';\n` + content;
      }
  }

  if (file === 'src/components/AutoDayOverlay.tsx') {
      content = content.replace(/Object\.values\(entries\) as any\[\]/g, "Object.values(entries) as DailyEntry[]");
      content = content.replace(/Object\.values\(entries\)/g, "Object.values(entries) as DailyEntry[]");
      content = content.replace(/Object\.values\(entries as DailyEntry\[\]\)/g, "Object.values(entries) as DailyEntry[]"); // cleanup
      
      content = content.replace(/find\(\(t: any\) =>/g, "find((t: TemplateDefinition) =>");
      content = content.replace(/find\(t =>/g, "find((t: TemplateDefinition) =>");
  }

  // Ensure DailyEntry is imported if we injected it
  if (content !== original) {
      if (!content.includes('import type { DailyEntry') && !content.includes('import { DailyEntry')) {
          const depth = file.split('/').length - 2; // src/pages = 1
          const rel = depth === 1 ? '../types' : '../../types';
          content = `import type { DailyEntry, DayBlock, TemplateDefinition } from '${rel}';\n` + content;
      } else if (!content.includes('DayBlock')) {
          content = content.replace(/DailyEntry(.*?)} from ('.*types')/, 'DailyEntry, DayBlock$1} from $2');
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`Updated ${file}`);
  }
});
