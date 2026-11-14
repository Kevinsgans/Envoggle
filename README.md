# Envoggle

A live 1v1 scavenger hunt. Both players watch each other hunt for the same category, lock in a rear-camera frame, and confirm what they found. The rarest eligible find wins.

## Run the browser arena

Use Node.js 24 and a LiveKit project. Copy `.env.example` to `.env` and fill in the LiveKit settings and `GEMINI_API_KEY`. Then run:

```bash
npm ci
npm test
npm start
```

Open `http://localhost:3000` on the development machine. For two phones, serve the same app over HTTPS so their browsers can access the cameras. Create a challenge, send its URL through Messages, then use both devices to accept, ready up, and lock in a find. The MVP ships with one category, **Things that are blue**. Use `npm run draft-dictionary -- "Things that are blue"` to print an AI draft. Review the names, aliases, and tiers before applying approved entries to `src/categories.ts`.

Rooms are kept in memory for up to two hours, including the current round and the most recent result frames. Use a single server instance for the demo. Restarting the server ends active rooms.

## Set up the iMessage invite

Open `ios/Envoggle.xcodeproj` in Xcode. Set a signing team and unique bundle identifiers for the host and embedded Messages extension. In the `EnvoggleMessages` target, set `ENVOGGLE_SERVER_URL` to the public HTTPS address of the Envoggle server. Install the app on both iPhones before opening the Envoggle extension in Messages. The host sends a challenge card, the guest accepts and can send an acceptance card, and the players start FaceTime using Apple’s controls.

## Connect the FaceTime referee

1. Ask the hackathon sponsor for a Chert project and an assigned FaceTime line. Verify the agent can join a Group FaceTime call with two iPhones, receive separately attributable audio and video for both players, and publish its own audio and video. The public Chert guide describes one caller camera. A single or mixed feed cannot support this duel.
2. In addition to the server settings, set `OPENAI_API_KEY` for speech, a shared random `REFEREE_KEY`, and the four player track names in `.env`. Set participant identity prefixes if track names overlap. Use the Media track log output to confirm the line's track names. Keep credentials in `.env`.
3. Run the Envoggle server and `npm run agent` in separate terminals. Follow the [Chert quickstart](https://docs.trychert.com/facetime-cli/quickstart) to connect the same LiveKit project and start `chert dev --agent envoggle-referee`. Both processes need to stay running. Chert's default credential loading accepts `.env`.
4. Player 1 says “Code” followed by the eight invite digits, one at a time. Both players say “Ready” to start or “Ready and save my frame” to opt in when retention is configured. Say “Lock it in” to capture or replace a frame. Answer “yes” or “no” for a known guess. For multiple guesses, say the option number or “my item is” followed by your own name. Say “ready” to rematch.
5. Test two consecutive calls on real phones. Check both camera views on each device and show different objects at the same time to verify capture attribution. If the bridge exposes only one player's media, use the browser arena for the live demo.

To collect targeted referee logs during a test call:

```bash
npm run agent 2>&1 | rg --line-buffered '\[envoggle\]' > envoggle-referee.log
```

## Training frames

Retention is disabled unless `TRAINING_DATA_DIR` is configured. If enabled, the server writes a metadata-stripped JPEG and a label record for each verified, opted-in find that passes the model’s privacy check. Keep that directory private and review records before exporting or sharing them.

## Verification

`npm test` runs the TypeScript build and the round tests with mocked model responses. To compile the native targets without device signing:

```bash
xcodebuild -project ios/Envoggle.xcodeproj -scheme Envoggle \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```
