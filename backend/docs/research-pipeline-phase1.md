# TrainRekt Token Research Pipeline (Phase 1)

Phase 1 introduces a provider-neutral research orchestration seam for token context expansion.

## Trust Boundary

External research input is untrusted.

External systems may propose:
- sources
- documented claims
- observed-fact relationships

External systems may only claim metadata such as source type, canonical website status, and identity hints. Those are not trusted conclusions.

External systems may not establish:
- deterministic verification (`Verified`)
- deterministic protocol classification confidence
- token safety/scam labels
- trading recommendations

Principle:

AI researches context. Deterministic code establishes facts and verification.

## Pipeline

1. Detect unresolved research needs from deterministic inspection output.
2. Build a minimal provider-neutral research request.
3. Call research provider (NoOp in Phase 1).
4. Validate and promote candidate data into trusted research context.
5. Run trusted source and identity assessment before promotion.
6. Run deterministic reconciliation for supported claim semantics.
7. Merge with existing trusted protocol context using deterministic precedence.
8. Persist fresh research snapshot separately from inspection snapshot.

## Key Safety Rules

- Candidate research cannot directly deserialize into trusted `DocumentedClaim` with `Verified` state.
- Provider output cannot directly assert trusted identity confirmation or trusted source class/canonical website status.
- Candidate claims are promoted as documentation-level claims only.
- Consistency (`Consistent` / `Conflict` / `Unknown`) is tracked separately from verification status.
- Existing deterministic `Verified` claims cannot be downgraded or overwritten by external data.
