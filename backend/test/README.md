# Backend verification

`npm test` in `backend` compiles the server and runs the isolated rule and transport tests.

For the real HTTP/WebSocket scenarios, first run `npm ci` in both `backend` and `frontend`, then run `npm run test:socket` in `backend`. The runner reuses the frontend's existing `socket.io-client` dependency and starts a temporary Nest server on an automatically assigned `127.0.0.1` port. It does not use or restart development servers on ports 3000/3001. Local port access must be allowed by the execution environment.

The socket suite runs 97 scenarios: free practice and training 1–8 with 2–5 clients through victory (36), campaign 9–66 through setup, personalized state, reconnect and lobby return (58), Toy Battle / No Touch Kraken startup and return (2), and Fellowship private hands, chapter start, character action, and host token security (1). It checks public HTTP reads and rejects session impersonation. Training deals are solved by combining the test clients' own views; campaign rule outcomes and timed events have separate deterministic engine tests. Set `TRAINING_ONLY=1`, `CAMPAIGN_ONLY=1`, `FELLOWSHIP_ONLY=1` or `NON_AUDIO_ONLY=1` to narrow a run. Its filename is separate from `*.test.cjs` so `npm test` remains independent of frontend dependencies and local networking.

The frontend suite and production build run with `CI=true npm test -- --watchAll=false --runInBand` and `CI=true npm run build` from `frontend`. Browser smoke checks cover two-player setup, mission 66 instructions and bunker rendering, desktop/mobile layout and client runtime errors.
