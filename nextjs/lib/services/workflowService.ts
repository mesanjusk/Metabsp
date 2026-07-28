import Workflow from '../models/Workflow';
import { matchAutoReplyRule } from './autoReplyService';

// Ported from backend/src/services/workflowService.js.
export const resolveMatchingWorkflow = async (incomingText: string, filters: Record<string, unknown> = {}): Promise<any> => {
  let workflows: any[] = await Workflow.find({ isActive: true, ...filters }).sort({ createdAt: 1 });

  if (!workflows.length && (filters as any).userId) {
    workflows = await Workflow.find({ isActive: true, userId: (filters as any).userId }).sort({ createdAt: 1 });
  }

  return matchAutoReplyRule(incomingText, workflows);
};
