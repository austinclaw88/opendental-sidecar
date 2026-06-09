# Graphify — Code Graph

## Status

Code graph generation requires the Graphify Python tool (`graphifyy`) running against the full source tree. Not available on all development machines.

For the OpenDental reference codebase, a pre-built graph exists at:
- `/Users/austinchen/.openclaw/workspace/opendental-graphify/PHASE1_DATA_DICTIONARY.md`

## Usage

```bash
# Generate a graph from the codebase
graphify build . --output docs/graphify/graph.json

# Query the graph
graphify path "PatientsController" "PatientRepository" --graph docs/graphify/graph.json
graphify explain "ClaimRepository" --graph docs/graphify/graph.json
```

## Architecture Hotspots

From the Phase 1 deep dive analysis of the OpenDental codebase:

| Hotspot | Density | Description |
|---------|---------|-------------|
| `ClaimRepository` | High | Most complex repository — N+1 risk, multiple joins |
| `PatientRepository` | High | Search queries across many columns |
| `ClaimController + ClaimRepository` | High | Tight coupling, potential for extraction |
| AuditMiddleware | Medium | Cross-cutting concern, should be configurable |

## Dependency Flow

```
Controllers → Repository Interfaces → Repository Implementations → MySQL
```

All dependencies flow in one direction. No circular dependencies detected.
