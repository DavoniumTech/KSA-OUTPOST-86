# v2.3.0 — Known limitations and honest scope

- Babylon.js is loaded from the official CDN at `https://cdn.babylonjs.com/babylon.js`. It is not bundled into the ZIP. If that host cannot be reached, the Canvas 2D fallback keeps the application shell and mission interface available, but does not provide equivalent interactive 3D rendering.
- WebGPU depends on the browser and device. WebGL is the intended fallback.
- Earth, Moon and Mars terrain in this release is procedurally generated for an educational simulation. It is not a verified topographic reconstruction or measured live planetary terrain product.
- Astronauts, spacecraft, rover and habitat components are procedural scene models. They are not certified engineering models or imported NASA photogrammetry.
- The interplanetary journey is a cinematic educational sequence, not a validated orbital mechanics or trajectory-planning solver.
- Mars resource meters, crew readiness and event effects are simplified game values, not spacecraft specifications, medical measurements or operational procedures.
- The Mission Control helper is a deterministic offline knowledge helper, not a generative AI service and not a live NASA connection.
- Browser-local saves are tied to the current browser profile/device. There is no account system or cross-device synchronization configured in the supplied repository.
- NASA source links are supplied for learning and future research. Not every current procedural visual asset is NASA-derived.
- The release container could not fetch GitHub or npm packages. TypeScript and unit tests passed, but the Vite production bundle and browser/device smoke tests were not run in this environment.
- The supplied GitHub Actions workflow is for GitHub Pages. The existence of `wrangler.jsonc` alone does not prove that a Cloudflare account, Worker or Pages Git integration is connected. Confirm the actual Cloudflare deployment configuration separately.
