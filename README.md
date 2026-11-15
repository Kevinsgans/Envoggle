# Envoggle

A live 1v1 scavenger hunt. Both players watch each other hunt for the same category, lock in a rear-camera frame, and the referee names and scores each find from that frame. The rarest eligible find wins.

## Run the browser arena

Use Node.js 24 and a LiveKit project. Copy `.env.example` to `.env` and fill in the LiveKit settings and `GEMINI_API_KEY`. Then run:

```bash
npm ci
npm test
npm start
```

Open `http://localhost:3000` on the development machine. For two phones, serve the same app over HTTPS so their browsers can access the cameras. Create a challenge, send its URL through Messages, then use both devices to accept, ready up, and lock in a find. The MVP ships with one category, **Things that are blue**. Use `npm run draft-dictionary -- "Things that are blue"` to print an AI draft. Review the names, aliases, and tiers (common, uncommon, rare, super rare, ultra rare) before applying approved entries to `src/categories.ts`.

When scoring finishes, the browser arena uses the model's best-item box to crop the find, then runs the MIT-licensed BEN2 background-removal model locally on the server to produce a transparent PNG cutout. The ONNX model downloads from Hugging Face the first time a cutout is requested and is cached by Transformers.js. Segmentation failure falls back to the object crop. The green scan animation plays over the locked photo while scoring runs.

Rooms are kept in memory for up to two hours, including the current round and the most recent result frames. Use a single server instance for the demo. Restarting the server ends active rooms.

## Set up the iMessage invite

Open `ios/Envoggle.xcodeproj` in Xcode. Set a signing team and unique bundle identifiers for the host and embedded Messages extension. In the `EnvoggleMessages` target, set `ENVOGGLE_SERVER_URL` to the public HTTPS address of the Envoggle server. Install the app on both iPhones before opening the Envoggle extension in Messages. The host sends a challenge card, the guest accepts and can send an acceptance card, and the players start FaceTime using Apple’s controls.

## Connect the FaceTime referee

1. Ask the hackathon sponsor for a Chert project and an assigned FaceTime line. Verify the agent can join a Group FaceTime call with two iPhones, receive separately attributable audio and video for both players, and publish its own audio and video. The public Chert guide describes one caller camera. A single window feed works only in the two-tile layout described in step 2.
2. In addition to the server settings, set a shared random `REFEREE_KEY` in `.env`. The referee listens with Gemini (`GEMINI_API_KEY`) and speaks with the Mac's built-in `say` voice, because free-tier Gemini speech allows only 10 requests a day (set `ENVOGGLE_VOICE=gemini` to use it anyway). Set `OPENAI_API_KEY` only to use OpenAI speech for both. With the `CHERT_PLAYER_*` settings blank, each call participant becomes the next free player. If the line sends one feed showing the Group FaceTime window (Chert beta.21 does), the referee finds the two-tile layout and takes player 1 from the left tile and player 2 from the right tile; the call audio is then mixed, so commands count for both players. If one participant carries separate tracks for both players, set the four track names (and identity prefixes if track names overlap) from the Media track log output. Keep credentials in `.env`.
3. Run the Envoggle server and `npm run agent` in separate terminals. Follow the [Chert quickstart](https://docs.trychert.com/facetime-cli/quickstart) to connect the same LiveKit project and start `chert dev --agent envoggle-referee`. Both processes need to stay running. Chert's default credential loading accepts `.env`.
4. Once both players are on camera, the referee asks the Orange player, then the Blue player, to say their name. It listens for names only: the first name heard is Orange (player 1) and the second is Blue (player 2). Ordinary words such as “good” are ignored, using the macOS dictionary files in `/usr/share/dict`. Its tile shows each player's live camera, mirrored like a selfie view, in their colour box so each player knows their colour (say “skip” to play as Orange and Blue). The referee then creates a challenge for the call on its own and says “Say start to play.” No invite code is needed. Either player says “Start” to begin the round for both (“Start and save my frame” opts the speaker in when retention is configured and players have separate audio). Hold your find up to the camera: the referee captures both players’ views just before time runs out. The hunt lasts 30 seconds. There is no confirmation step: one model call per player (Claude when `ANTHROPIC_API_KEY` is set, otherwise Gemini) lists every object in the frame that fits the category and rates each from 1 to 1000, where higher is more niche. The player scores their best item. Dictionary items score their fixed points from `src/categories.ts` (pen 15); only items not in the dictionary use the model’s rating. The referee's tile shows the timer during the hunt and, at the reveal, each player's captured frame with their best item, score and rarity tier. Say “start” or “rematch” to play again.
5. Test two consecutive calls on real phones. Check both camera views on each device and show different objects at the same time to verify capture attribution. If the bridge exposes only one player's media, use the browser arena for the live demo.

To collect targeted referee logs during a test call:

```bash
npm run agent 2>&1 | rg --line-buffered '\[envoggle\]' > envoggle-referee.log
```

## Training frames

Retention is disabled unless `TRAINING_DATA_DIR` is configured. If enabled, the server writes a metadata-stripped JPEG and a label record for each verified, opted-in find that passes the model’s privacy check. Keep that directory private and review records before exporting or sharing them.

## Verification

Use `npm run preview` and open `http://127.0.0.1:4173` to inspect the current FaceTime referee tile with sample data. Click **Play scan and reveal** to see both finds scanned, rotated and outlined, then watch the scores count up before the reveal. Use **Play countdown** to see the hunt lead into the same animation. The safe-area toggle shows the center region where the tile keeps important content. The sample preview uses the live tile renderer and needs no FaceTime call or credentials. After editing `src/tile.ts`, run `npm run build` in a second terminal and refresh the preview.

Under **Test with your photos**, capture or choose a photo for each player and click **Render my photos**. Rendering sends both photos to the judge configured in `.env` using `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`. **Replay my photos** plays the cached result without another judge request. The preview server keeps the photos in memory for up to 30 minutes.

`npm test` runs the TypeScript build and the round tests with mocked model responses. To compile the native targets without device signing:

```bash
xcodebuild -project ios/Envoggle.xcodeproj -scheme Envoggle \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```
