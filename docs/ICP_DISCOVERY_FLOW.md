# ICP Discovery Flow (2025-09)

## Overview
The chat runtime now runs a 10-step discovery interview before Sam generates any campaign copy. The flow mirrors the spec provided by the GTM team and persists structured data so campaigns can reuse the answers.

## Storage
- **Table**: `sam_icp_discovery_sessions`
- **Key fields**: `discovery_payload`, `discovery_summary`, `phases_completed`, `thread_id`
- **Access**: RLS ties every row to the user's workspace.
- **RPC**: `upsert_icp_discovery_payload` safely merges new answers and tracks shallow responses.

Each discovery session records:
- Who the ICP is (role, industry, stage)
- Objectives, focus areas, and long-term aspirations
- Pain points, why they hurt, and how people currently cope
- Success criteria for adopting a new solution
- Customer language (authentic phrases)
- Objections, fears, disappointments, and past failures to preempt roadblocks
- Positioning hooks derived from the answers

## Conversation Loop
1. The chat detects campaign intent (`#messaging`, "create a campaign", etc.).
2. Sam starts or resumes a discovery session, setting the thread stage to `icp_discovery`.
3. Each user reply is validated. Short or generic answers increment a shallow-response counter so the assistant can push for better detail.
4. After all phases complete, Sam summarises the ICP and switches the thread to `discovery_complete` with a 100% progress indicator.
5. Discovery payloads feed directly into the template-selection engine via `mapDiscoveryToProspect`.

## Template Integration
`TemplateSelectionEngine.selectTemplateFromDiscovery` converts the discovery payload into a prospect profile. Primary pain point, expectation, and urgency now drive template scoring so the next campaign request can immediately render the best-performing LinkedIn sequence.

## Testing
Run the lightweight regression to confirm mapping logic:

```bash
npx ts-node tests/icp-discovery-flow.test.ts
```

## Next Steps
- Wire completed discovery sessions into the campaign-generation API so the user can approve the summary and trigger template drafting without re-answering questions.
- Backfill existing threads with completed discovery data where available.
- Expand the shallow-response heuristics with more domain-specific patterns.

## Auto-Sequence Generation
- Completed discovery sessions can now trigger the 8-step LinkedIn sequence generator by messaging “generate the sequence” (or `#sequence`).
- The generator pulls from `lib/templates/industry-blueprints.ts` and `lib/templates/sequence-builder.ts` to adapt hooks, proof, and CTA to the captured ICP.
- Output is injected back into the chat (and stored on the thread) ready for human edits before activation.
