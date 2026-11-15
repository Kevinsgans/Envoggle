# Envoggle

A live 1v1 scavenger hunt on FaceTime with an AI referee. Two friends start a game from iMessage, an AI referee calls them both on a Group FaceTime, gives a category, and scores what each player holds up to the camera.

## How it works: an AI referee in a Group FaceTime, through Chert

[Chert](https://docs.trychert.com) gives us a real FaceTime line that a program can use. Envoggle's referee is a LiveKit agent, and Chert bridges the FaceTime call into the LiveKit room where the referee lives:

```
iMessage app ──Start Game──▶ Envoggle server ──POST /calls──▶ Chert line ──Group FaceTime──▶ both players
                                   │                              │
                                   ▼                              ▼
                             LiveKit room  ◀── call video and audio ──  Chert bridge (chert dev)
                                   │
                                   ▼
                        Referee agent: sees the call, hears names,
                        scores finds, publishes its own tile and voice
```

1. **Start a game.** In a one-on-one Messages chat, the host opens **+ → Envoggle** and taps **Start Game**. The extension sends an invite bubble and calls `POST /api/group-call` on our server.
2. **The server sets up the call.** It creates a LiveKit room, dispatches the `envoggle-referee` agent and waits until the referee's voice and video are live. It then gives Chert a token for that room and asks it to place one Group FaceTime call from our line to both numbers (`direction: outbound`, `mode: customer_managed`).
3. **Chert bridges FaceTime and LiveKit.** Chert's bridge joins the room. It publishes the FaceTime window (both players) as one video track and the call audio as one mixed track. It plays the referee's video and voice into FaceTime, so the referee shows up as a caller with its own tile.
4. **The referee runs the game.** It finds the two player tiles inside the FaceTime window and asks each player to say their name. Then it plays three 20-second rounds and scores each find with a vision model.
5. **Hang up.** When the game ends or a player leaves, the referee closes the room and the server asks Chert to end the call (`POST /calls/{id}/end`). The line is then free for the next game.

### What Chert gives a group call, and how we handle it
- **One video feed for both players.** A group call arrives as one video feed (the FaceTime window), not one feed per player. The referee finds the two-tile layout in that window and crops player 1 from the left tile and player 2 from the right tile.
- **Mixed audio.** The call audio is mixed, so voice commands count for both players. Names are assigned in order: the first name heard is Orange (player 1), the second is Blue (player 2).
- **One call per line.** One line handles one call at a time, and one `chert dev` runs per line.
- **Verified numbers.** On Free and Shared lines, both players' numbers must be verified with Chert.
- **Stuck hang-ups.** Closing the room doesn't always end the FaceTime call; Chert can leave it in an "ending" state. The server ends it explicitly, asks again after 15 seconds of "ending", and frees the line on our side after 45 seconds.

## A game
1. **Names.** Both players are on camera, and the referee's tile shows each one's live camera, mirrored, in their colour box. The referee asks Orange, then Blue, to say their name. It only accepts real names: words such as "good" are ignored, using the dictionary files in `/usr/share/dict`. Say "skip" to play as Orange and Blue.
2. **Rounds.** Round 1 starts right away, with no start screen and no invite code. The referee announces the category, and each player has **20 seconds** to find something and hold it up to the camera. The referee captures both views just before time runs out.
3. **Scoring.** Each player's frame gets one model call, with no confirmation step (see [Scoring](#scoring)). The tile shows each captured frame with the best find outlined, its score and its tier, and the referee says each find, its points and the round winner.
4. **Next round.** The next round starts on its own 10 seconds after each reveal. A void round, for example after a dropped camera, replays after 5 seconds.
5. **Final scores.** After round 3 the reveal shows for 12 seconds. Then a final scores screen shows each round's points, the totals and the winner, and the game stops.
6. **Leaving.** The referee hangs up when a player leaves, in either of two ways:
   - FaceTime switches from two tiles to one person for 5 seconds after the final scores, or 25 seconds mid-game, since a paused video looks the same for a while.
   - A player's own participant disconnects.

## Scoring
- **One model call per player.** The model lists every object in the frame that fits the category, rates each from 1 to 1000 on the category's scale (higher is more niche or extreme), and traces each object's outline. The player scores their best item.
- **Which model.** Gemini (`GEMINI_MODEL`, default `gemini-3.5-flash`), or Claude (`ANTHROPIC_MODEL`, default `claude-opus-5-5`) when `ANTHROPIC_API_KEY` is set.
- **Fixed anchor scores.** Each category has fixed anchor items in `src/categories.ts` (for example, guitar 668 in Longest thing). A recognised anchor always scores its fixed points. Anything else uses the model's rating.
- **No round numbers.** Scores never land on a multiple of 5. The model is asked for precise integers, and any multiple of 5 is nudged down 1–4 points, the same nudge every time for the same item (pen 15 → 13).
- **No ties.** In a tied round, the find the model itself rated higher gets +1 (+2 if +1 would land on a multiple of 5), then the bigger-looking find wins, then a coin flip. A round only stays tied at 0–0. A tied total after round 3 goes to the last round's winner, or after a 0–0 last round, to the best single round.

| # | Category | Scale (1–1000) |
|---|---|---|
| 1 | Rare things that are blue | how rare it is to have at hand on a college campus (construction paper ≈ 547, chip bag ≈ 263) |
| 2 | Things that use the most electricity | typical power draw, log scale: 1 W ≈ 333, 1,000 W ≈ 833 |
| 3 | Most expensive thing | typical price new, log scale: $10 ≈ 333, $1,000 ≈ 667 |
| 4 | Heaviest thing | weight, log scale: 1 kg = 500 |
| 5 | Oldest thing | years since made, log scale: 10 years = 500 |
| 6 | Most calories | whole container, log scale: 100 kcal = 500 |
| 7 | Longest thing | longest dimension, log scale: 1 m ≈ 667 |

Each game plays three categories, drawn at random with no repeats (`ROUNDS_PER_MATCH`). To fix them, set `ENVOGGLE_ROUNDS` to three 1-based positions from the table, in play order (for example `2,3,4`).

## Set up

You need Node.js 24, a LiveKit project, a Gemini API key, a Chert project with a FaceTime line, and an iPhone for the host.

### 1. Server and referee
1. Copy `.env.example` to `.env` and fill it in:
   - **LiveKit:** `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
   - **AI:** `GEMINI_API_KEY`, and optionally `ANTHROPIC_API_KEY`.
   - **Referee:** a random `REFEREE_KEY`, shared by the server and the agent.
   - **Chert:** `CHERT_FACETIME_API_KEY` (with `facetime:read` and `facetime:write`), `CHERT_PROJECT_ID` and `CHERT_LINE_ID`.
   - **Players:** `ENVOGGLE_CALL_HOST_PHONE` and `ENVOGGLE_CALL_GUEST_PHONES` (comma-separated, with country codes), the only numbers Chert may dial.
2. Choose the voices:
   - **Listening:** Gemini speech-to-text.
   - **Speaking:** a local voice, so there's no quota (free-tier Gemini speech allows 10 requests a day). On a Mac it's the built-in `say`. On Linux it's [Piper](https://github.com/OHF-Voice/piper1-gpl), with the voice model in `ENVOGGLE_PIPER_MODEL` and `piper` on PATH (or `ENVOGGLE_PIPER`).
   - **Other options:** `ENVOGGLE_VOICE=gemini` forces Gemini's voice. `OPENAI_API_KEY` switches both listening and speaking to OpenAI.
   - **Linux dictionary:** copy `/usr/share/dict/propernames` and `words` from a Mac and set `ENVOGGLE_DICT_DIR`.
3. Run these in three terminals:
   ```bash
   npm ci && npm test
   npm start                                      # game server on :3000
   npm run agent                                  # the referee (LiveKit agent)
   chert dev --agent envoggle-referee             # Chert bridge, same LiveKit project (see the Chert quickstart)
   ```
   Keep all three running. On a Linux server, use three systemd user services (server, agent, then `chert dev`):
   - Stop `chert dev` with SIGINT.
   - Run only one `chert dev` per line.
   - Avoid restarting it needlessly: Chert re-checks the Mac behind the line on start and can refuse the bridge for a while.
4. Serve the server over HTTPS, and keep `/api/group-call` reachable only by trusted devices (we use `tailscale serve`).

With the `CHERT_PLAYER_*` settings blank, each call participant becomes the next free player. That's correct for the single window feed. If your line sends separate tracks for each player, set the four track names, plus identity prefixes if the track names overlap, from the `Media track` log lines.

### 2. iMessage app
1. Open `ios/Envoggle.xcodeproj`, configure signing, set `ENVOGGLE_SERVER_URL` in the `EnvoggleMessages` target to your HTTPS server, and install it on the host's iPhone.
2. In a one-on-one Messages chat, open **+ → Envoggle**, save both FaceTime numbers and tap **Start Game**. The guest number is remembered per chat, and the host number is reused for every chat. Both players answer the incoming FaceTime.

### 3. Test
Test two calls in a row on real phones. Show different objects at the same time to check that each player's find is scored for the right player. To collect the referee's logs:
```bash
npm run agent 2>&1 | rg --line-buffered '\[envoggle\]' > envoggle-referee.log
```

## Recording a call for a demo video
Set `ENVOGGLE_RECORD_DIR` for `npm run agent` and install `ffmpeg`. Each call gets its own folder:
- **Video:** every frame of the call feed (`call-p1-*.mkv`) and of the referee's tile (`referee-*.mkv`), as near-lossless H.264 timed by the wall clock.
- **Audio:** the call audio (`call-audio-p1.s16le`, 48 kHz) and the referee's voice (`referee-voice.s16le`).
- **Timing:** start times in `manifest.json`.

`node scripts/render-recording.mjs <folder>` lines everything up into `demo.mp4`: the call on the left, the referee's tile on the right, at 30 fps, with both audio tracks mixed.

## Browser arena (fallback without FaceTime)
`npm start` also serves a browser version at `http://localhost:3000`. For two phones, serve it over HTTPS so the browsers can use the cameras.
- **Playing:** create a challenge, send its URL in Messages, and on both devices accept, ready up and lock in a find.
- **Cutouts:** the arena cuts the find out with the MIT-licensed BEN2 background-removal model, run locally with Transformers.js. It downloads from Hugging Face on first use and falls back to the object crop.
- **Limits:** rooms live in memory for up to two hours, so run a single server instance; a restart ends active rooms.

## Preview and tests
- `npm run preview`, then open `http://127.0.0.1:4173`, shows the referee tile with sample data, without a FaceTime call or credentials.
  - **Play scan and reveal** and **Play countdown** run the animations.
  - **Test with your photos** sends two photos to the configured judge and replays the cached result.
  - After editing `src/tile.ts`, run `npm run build` in a second terminal and refresh.
- `npm test` builds the TypeScript and runs the tests with mocked model responses.
- To compile the iOS targets without signing:
  ```bash
  xcodebuild -project ios/Envoggle.xcodeproj -scheme Envoggle \
    -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
  ```

## Training frames
Off unless `TRAINING_DATA_DIR` is set. When it's set, the server keeps a metadata-stripped JPEG and a label for each opted-in find that passes the model's privacy check. In a call, players opt in by saying "Start and save my frame", which works only with separate audio for each player. Keep the folder private and review it before sharing.
