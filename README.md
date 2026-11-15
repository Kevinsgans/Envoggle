# Envoggle

A live 1v1 scavenger hunt. Both players watch each other hunt for the same category, lock in a rear-camera frame, and the referee names and scores each find from that frame. The rarest eligible find wins.

## Run the browser arena

Use Node.js 24 and a LiveKit project. Copy `.env.example` to `.env` and fill in the LiveKit settings and `GEMINI_API_KEY`. Then run:

```bash
npm ci
npm test
npm start
```

Open `http://localhost:3000` on the development machine. For two phones, serve the same app over HTTPS so their browsers can access the cameras. Create a challenge, send its URL through Messages, then use both devices to accept, ready up, and lock in a find. There are eight categories; each match plays three of them, drawn at random with no repeats (`ROUNDS_PER_MATCH` in `src/categories.ts`); set `ENVOGGLE_ROUNDS` to three 1-based positions in that list (for example `1,7,8` = blue, calories, longest) to fix the categories and their order, and then the match is over: there is no new match in the same call. Each is scored from 1 to 1000 on its own scale, mostly log scales of a real quantity: **Heaviest thing** (weight: 1 kg = 500), **Oldest thing** (years since made: 10 years = 500), **Loudest thing** (decibels in normal use: 75 dB = 500), **Most calories** (whole container: 100 kcal = 500), **Longest thing** (longest dimension: 1 m ≈ 667), plus **Rare things that are blue** (how rare it is to have the item at hand on a college campus; craft and hobby items such as construction paper ≈ 547 rank above everyday items such as a chip bag ≈ 263), **Things that use the most electricity** (typical power draw on a log scale: 1 W ≈ 333, 1,000 W ≈ 833), and **Most expensive thing** (typical price new on a log scale: $10 ≈ 333, $1,000 ≈ 667). Dictionary items in `src/categories.ts` have fixed scores on those scales. Scores are never round numbers: the model is told to give precise integers, and any multiple of 5 (including dictionary scores such as pen 15 → 13) is nudged down by 1 to 4 points, fixed per item. The scoreboard adds each player's points across all three rounds. There are no ties: when both players score the same in a round, the find the model itself rated higher gets 1 more point (2 if 1 would land on a multiple of 5), then the bigger-looking find, then a coin flip; a round only stays tied when neither player found anything. If the totals are level after round three, the last round's winner (or, after a 0–0 last round, the player with the best single round) gets the extra point and the match. A void round replays the same prompt. After the third round the match is over; another start does nothing.

When scoring finishes, the browser arena uses the model's best-item box to crop the find, then runs the MIT-licensed BEN2 background-removal model locally on the server to produce a transparent PNG cutout. The ONNX model downloads from Hugging Face the first time a cutout is requested and is cached by Transformers.js. Segmentation failure falls back to the object crop. The green scan animation plays over the locked photo while scoring runs.

Rooms are kept in memory for up to two hours, including the current round and the most recent result frames. Use a single server instance for the demo. Restarting the server ends active rooms.

## Set up the iMessage invite

1. Confirm that your assigned Chert line supports outbound group video and captures both caller tiles. Free and Shared lines require both players’ numbers to be verified with Chert. Set `CHERT_FACETIME_API_KEY`, `CHERT_PROJECT_ID`, and `CHERT_LINE_ID` in the server’s `.env`. The project API key needs `facetime:read` and `facetime:write`. Set `ENVOGGLE_CALL_HOST_PHONE` to the host’s FaceTime number and `ENVOGGLE_CALL_GUEST_PHONES` to the permitted guest numbers, separated by commas. Include country codes. [Chert group calls](https://docs.trychert.com/facetime/group-calls)
2. Serve Envoggle over HTTPS and run `npm start` and `npm run agent` with the same LiveKit project. Keep `/api/group-call` reachable only by trusted devices because the phone list limits who Chert may dial. Open `ios/Envoggle.xcodeproj`, configure signing, set `ENVOGGLE_SERVER_URL` in the `EnvoggleMessages` target to that HTTPS URL, and install Envoggle on the host’s iPhone.
3. In a one-on-one Messages conversation, open **+ → Envoggle** and save the two FaceTime numbers. Envoggle remembers the guest number for that conversation and reuses your host number for other chats. Tap **Start Game** to send the iMessage invitation and request one Group FaceTime call from the configured Chert line. Both players answer the incoming call. [Messages participant identifiers](https://developer.apple.com/documentation/messages/msconversation/remoteparticipantidentifiers)

## Connect the FaceTime referee for incoming calls

1. Ask the hackathon sponsor for a Chert project and an assigned FaceTime line. Verify the agent can join a Group FaceTime call with two iPhones, receive separately attributable audio and video for both players, and publish its own audio and video. The public Chert guide describes one caller camera. A single window feed works only in the two-tile layout described in step 2.
2. In addition to the server settings, set a shared random `REFEREE_KEY` in `.env`. The referee listens with Gemini (`GEMINI_API_KEY`) and speaks with a local voice: the Mac's built-in `say`, or on Linux [Piper](https://github.com/OHF-Voice/piper1-gpl) with the voice model in `ENVOGGLE_PIPER_MODEL` (`piper` on PATH or `ENVOGGLE_PIPER`), because free-tier Gemini speech allows only 10 requests a day (set `ENVOGGLE_VOICE=gemini` to use it anyway). Set `OPENAI_API_KEY` only to use OpenAI speech for both. With the `CHERT_PLAYER_*` settings blank, each call participant becomes the next free player. If the line sends one feed showing the Group FaceTime window (Chert beta.21 does), the referee finds the two-tile layout and takes player 1 from the left tile and player 2 from the right tile; the call audio is then mixed, so commands count for both players. If one participant carries separate tracks for both players, set the four track names (and identity prefixes if track names overlap) from the Media track log output. Keep credentials in `.env`.
3. Run the Envoggle server and `npm run agent` in separate terminals. Follow the [Chert quickstart](https://docs.trychert.com/facetime-cli/quickstart) to connect the same LiveKit project and start `chert dev --agent envoggle-referee`. Both processes need to stay running. To run them on a Linux server instead, use three systemd user services (server, `npm run agent`, then `chert dev`), stop `chert dev` with SIGINT, and run only one `chert dev` per line at a time. Chert's default credential loading accepts `.env`.
4. Once both players are on camera, the referee asks the Orange player, then the Blue player, to say their name. It listens for names only: the first name heard is Orange (player 1) and the second is Blue (player 2). Ordinary words such as “good” are ignored, using the macOS dictionary files in `/usr/share/dict` (`propernames` and `words`; on Linux copy them from a Mac and set `ENVOGGLE_DICT_DIR`). Its tile shows each player's live camera, mirrored like a selfie view, in their colour box so each player knows their colour (say “skip” to play as Orange and Blue). The referee then creates a challenge for the call on its own and round 1 starts right away: there is no start screen and no invite code. (When retention is configured and players have separate audio, the referee instead waits for “Start”, or “Start and save my frame” to opt the speaker in.) Hold your find up to the camera: the referee captures both players’ views just before time runs out. The hunt lasts 20 seconds. There is no confirmation step: one model call per player (Claude when `ANTHROPIC_API_KEY` is set, otherwise Gemini) lists every object in the frame that fits the category and rates each from 1 to 1000, where higher is more niche. The player scores their best item. Dictionary items score their fixed points from `src/categories.ts` (pen 13); only items not in the dictionary use the model’s rating. The referee's tile shows the timer during the hunt and, at the reveal, each player's captured frame with their best item, score and rarity tier. The referee keeps speech short: it announces each round number and prompt, then each player's find and points and the round winner (reasons and tiers are on the tile only), and the match winner with the final score after the third round. There is no voice command between rounds: the next round starts on its own 10 seconds after each reveal, and a void round replays after 5 seconds. After round three the reveal shows for 12 seconds, then a final scores screen lists each round's points, the totals and the match winner, and the game stops there. When a player leaves the call (FaceTime switches from the two-tile layout to one person for 5 seconds after the final scores, or 25 seconds mid-game, since a paused video looks the same for a while; or a player's own participant disconnects), the referee closes the LiveKit room, which ends the FaceTime call for everyone.
5. Test two consecutive calls on real phones. Check both camera views on each device and show different objects at the same time to verify capture attribution. If the bridge exposes only one player's media, use the browser arena for the live demo.

To collect targeted referee logs during a test call:

```bash
npm run agent 2>&1 | rg --line-buffered '\[envoggle\]' > envoggle-referee.log
```


### Recording a call for the demo video

Set `ENVOGGLE_RECORD_DIR` (for example `~/envoggle-recordings`) for `npm run agent` and install `ffmpeg`. The referee then records each call into its own folder: every frame of the incoming call feed (`call-p1-*.mkv`; in a group call this is the FaceTime window with both players) and of its own tile (`referee-*.mkv`), as near-lossless H.264 timed by the wall clock, plus the call audio at 48 kHz (`call-audio-p1.s16le`) and its own voice (`referee-voice.s16le`), with start times in `manifest.json`. Frames are recorded as received, not screen-captured, so they don't stutter. `node scripts/render-recording.mjs <folder>` lines them up into `demo.mp4`: the call on the left, the referee tile on the right, 30 fps, both audio streams mixed.

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
