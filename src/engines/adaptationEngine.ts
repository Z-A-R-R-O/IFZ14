import type { Suggestion, TemplateDefinition } from '../types';

export interface AdaptationResult {
  templateAdjustments?: { recommendedSystemType: 'domination' | 'balanced' | 'recovery' | 'execution' };
  blockAdjustments: { added: any[]; removed: string[] };
  weightAdjustments: { blockId: string; newWeight: number }[];
  summaryLog: string[];
}

export function runAdaptation(
  suggestions: Suggestion[],
  currentTemplate: TemplateDefinition,
): AdaptationResult {
  const result: AdaptationResult = {
    blockAdjustments: { added: [], removed: [] },
    weightAdjustments: [],
    summaryLog: [],
  };

  // 1. Stability Filter: Only Autonomous Agents act on High/Medium verified causality
  const actionable = suggestions.filter(s => s.confidence === 'High' || s.confidence === 'Medium');

  actionable.forEach(sig => {
    // ─── TEMPLATE MORPHING ───
    if (sig.actionType === 'switch_template' && sig.actionPayload?.systemType) {
       // Only switch if we aren't already running the recommended physics mode
       if (currentTemplate.systemType !== sig.actionPayload.systemType) {
           result.templateAdjustments = { recommendedSystemType: sig.actionPayload.systemType };
           result.summaryLog.push(`System Type Morphed to [${sig.actionPayload.systemType.toUpperCase()}] : ${sig.causalPath || sig.message}`);
       }
    }
    // ─── BLOCK INJECTION ───
    else if (sig.actionType === 'add_block') {
       const alreadyExists = currentTemplate.structure.some(b => 
         b.type === sig.actionPayload.blockType || 
         (b.type === 'custom' && b.title === sig.actionPayload.customName)
       );
       
       if (!alreadyExists) {
           result.blockAdjustments.added.push(sig.actionPayload);
           const typeLabel = sig.actionPayload.customName || sig.actionPayload.blockType;
           result.summaryLog.push(`Injected [${typeLabel.toUpperCase()}] Block : ${sig.causalPath || sig.message}`);
       }
    }
    // ─── BLOCK REMOVAL (NEGATIVE DETECTION) ───
    else if (sig.actionType === 'remove_block') {
       const targetBlock = currentTemplate.structure.find(b => b.type === sig.actionPayload.blockType);
       // Ensure structural locks are respected
       if (targetBlock && !targetBlock.meta?.locked) {
           result.blockAdjustments.removed.push(targetBlock.id);
           result.summaryLog.push(`Excised [${targetBlock.type.toUpperCase()}] Block : ${sig.causalPath || sig.message}`);
       }
    }
  });

  return result;
}
