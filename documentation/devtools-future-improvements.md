# Devtools Future Improvements

This note captures possible future enhancements for the devtools graph canvas.

None of these items are commitments. They are candidates for future work if real usage shows the current heuristics are not sufficient.

## Port-Aware Graph Layout And Routing

### Current behavior

The devtools graph currently uses ELK to place nodes, but final edge paths are still rendered afterward in React Flow from field handles.

This means the layout engine improves overall node placement, but it is not fully optimizing around the exact field-level attachment points used by relationships and materialization links.

Recent improvements already help by:

- reducing rerender churn during drag
- tuning ELK spacing and ordering for cleaner node placement
- reordering graph-visible PK/FK/join fields inside nodes to reduce local crossings

### Potential future improvement

A stronger next step would be a port-aware ELK integration.

In that model:

- each field handle would be represented as a real ELK port
- ELK would optimize layout using those exact ports, not just node centers
- ELK bend points / routed sections could be rendered directly instead of relying on generic smooth-step edges

### Expected benefit

This would likely improve the hardest graph cases more than additional heuristics:

- dense PK/FK graphs
- materialized views with several lineage and projection links
- cases where two nearby relationships cross only because their field handles are vertically misaligned

### Tradeoff

This is a materially larger refactor than the current heuristics.

It would require:

- exporting field handles as ELK ports
- preserving stable port ordering during expand/collapse and drag
- reading ELK edge routing output back into the React Flow edge renderer
- keeping selection, highlighting, and interaction behavior intact

For now, the current approach favors lower implementation cost and easier maintenance. If real-world devtools graphs still show too many awkward crossings after the current heuristics, port-aware layout/routing is the most credible next improvement.
