### Eval

**You own the experiment design. Plan, blind, run, synthesize.**

Non-negotiables for blinding:

- No `eval`, `test`, `judge`, `experiment`, `rubric`, `score`, `compare`, `benchmark`, `candidate`, or `arena` in any directory, file, or prompt the candidate sees.
- The candidate prompt looks like an organic user request. State the goal, not the meta.
- No chain-eliciting cues. Don't ask the candidate to list which skills, principles, or files they applied. Ask for design notes generally and grade chain-following from code shape, not self-report.
- Sanitize directory and slug names. Use project-shaped names a user might pick.
- Don't tell the candidate other candidates exist.
- The judge can know it's judging but sees outputs by sanitized label only, never by model name.
- Comparing two variants: one judge scores both sets in a single pass on one scale, blind to which set each came from.

Steps:

1. Frame the comparison. State what variant is under test and what behavior counts as success. Write three to six concrete rubric criteria for the judge only. Hold them back from candidates.
2. Set up sanitized environments. Use a working directory per candidate with the variant in place. Plant context an organic task would have, such as a project skeleton and the skills the candidate would naturally read.
3. Author one organic prompt. What a user would type. No leakage of what's being measured.
4. Spawn N parallel candidates on different models per the **arena** skill's Phase B. Each works in its own sanitized dir. Same prompt to each. An agent that only dispatches, polls, or packs results uses `role: swarm-workers`.
5. Spawn one blinded judge on a different model family per the **arena** skill's Phase C. Judge sees outputs by sanitized label and the rubric, never a model name.
6. Verify the chain from transcripts, not self-report. Read candidate transcripts only at workspace-scoped paths supplied by the runtime or task. Do not assume an `agent-transcripts/` directory exists. Do not glob other users' `$DSH_HOME` or Cursor project dirs. Look at which files each candidate actually opened. Grade chain-following from those reads plus the shape of the code. If transcripts are unavailable, report that limit rather than infer reads from claims.
7. Read every candidate output yourself end to end. Compare to the judge's verdict. Disagreement means a model is biased or the rubric is ambiguous. Synthesize.

**Reply:** variant under test, rubric, per-candidate notes, judge's verdict, your synthesis, and a recommendation for whether to promote the variant.
