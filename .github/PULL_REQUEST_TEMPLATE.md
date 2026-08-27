## Summary

Describe the problem and the meaningful behavior change.

## Validation

- [ ] Tests cover successful and failure paths.
- [ ] Public configuration, types, rule IDs, or exit-code changes are
      documented.
- [ ] `npm run qa` passes.
- [ ] No hosted dependency, telemetry, model call, or source mutation was added.

## Security and compatibility

- [ ] Paths and diagnostics do not expose secrets or escape project boundaries.
- [ ] Behavior is deterministic across repeated runs.
- [ ] Windows and Linux path behavior was considered.
