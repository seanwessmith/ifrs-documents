Update citation renderer to "Title p.X–Y"; collapse contiguous pages; add --cite=auto.

Steps:
1. Read codepaths that format citations in CLI and web renderer.
2. Implement grouping/collapse + tests.
3. Wire default flag, document usage.
4. Run tests & demo on 3 sample queries.
5. Commit + PR.