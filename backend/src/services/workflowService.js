const Workflow = require('../repositories/Workflow');
const { matchAutoReplyRule } = require('../middleware/autoReply');

// Workflows carry the same {isActive, keyword, matchType} shape AutoReply
// rules do, so the existing single-keyword matcher can be reused unchanged
// rather than re-implemented. Scope note: this is a linear, single-trigger
// step sequence (send, wait, send, ...) — not a branching/multi-trigger
// visual builder. That's a much larger, separate product investment (a
// canvas UI, per-contact run state, conditional branches); this ships the
// smallest genuinely useful version of "workflow" on top of what already
// exists (AutoReply's matching + the existing message-dispatch primitives).
const resolveMatchingWorkflow = async (incomingText, filters = {}) => {
  let workflows = await Workflow.find({ isActive: true, ...filters }).sort({ createdAt: 1 });

  if (!workflows.length && filters.userId) {
    workflows = await Workflow.find({ isActive: true, userId: filters.userId }).sort({ createdAt: 1 });
  }

  return matchAutoReplyRule(incomingText, workflows);
};

module.exports = { resolveMatchingWorkflow };
