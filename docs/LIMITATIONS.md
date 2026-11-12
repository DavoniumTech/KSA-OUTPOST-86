# KSA OUTPOST 86 v3.6.0 — Known limitations and honest scope

- The game worlds, terrain, astronauts, rocket/spacecraft, rover and habitats are original procedural educational visuals. They are not photogrammetric NASA models, certified engineering assets or commercial motion-capture character assets.
- The Mars material maps introduced in v3.6.0 are procedural art textures, not NASA surface imagery or measured physical material data.
- Earth surface artwork is illustrative rather than a current satellite basemap. Moon and Mars height geometry is procedural, not a verified digital elevation model.
- The interplanetary journey is a cinematic educational sequence, not a validated orbital mechanics or trajectory-planning solver.
- The astronaut and rover controllers provide the implemented game interactions, but this is not a full commercial physics sandbox. Movement, collisions and mission values are simplified for learning and demonstration.
- Resource meters, crew readiness, radiation levels and hazard outcomes are educational game values, not medical readings, operational spacecraft specifications or live telemetry.
- The Mission Control helper is deterministic and local; it is not a generative AI service or live NASA connection.
- Guest saves are stored in the current browser profile/device. Cloud sync requires a deployed and configured Cloudflare Worker, D1/DO bindings and valid production routing.
- The Worker source includes account/profile/save/event handling, but the presence of source code does not prove that production Cloudflare resources, secrets, routes or account delivery settings are configured.
- Browser notifications can be shown by an active page and, with permission, while the page is backgrounded. Web Push delivery after the browser is fully closed is not implemented as a verified service.
- Existing v2.2.0 lunar terrain asset provenance could not be independently verified from the supplied archive. Do not attribute those files to NASA without confirming their origin and licence.
- NASA science URLs in the app are references. This release does not claim that its procedural terrain was derived from NASA datasets or that a specific challenge Resources dataset has already been integrated. Verify and cite at least one dataset from the exact 2026 challenge Resources tab before making a Global Awards eligibility claim.
- In this build container, npm registry and GitHub DNS were unavailable. TypeScript, the existing test suite and JavaScript syntax checks could run, but the Vite production bundle and live browser/device performance tests could not be verified here.
- The latest live `main` branch could not be fetched from this container. The package is based on the V3.5 source ZIP available in the conversation, with v3.6 changes applied. The included deployment helper fetches and fast-forwards the user's authenticated `main` branch before overlaying the package, and refuses unsafe history divergence or local modifications.
