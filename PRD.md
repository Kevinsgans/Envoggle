# Envoggle — Product Requirements Document

**Release** · Emory Hacks MVP  
**Audience** · Friends with iPhones who want a quick competitive game over FaceTime  
**Submission** · Entertainment main track and Chert Best Use of FaceTime side challenge

## Product overview

Envoggle is a live 1v1 scavenger hunt. Challenge a friend in iMessage, meet in FaceTime, and race to find the rarest object that fits a shared category. Both players can see their own rear-camera view and their opponent’s live view while they search. Seeing someone find a better object is what makes it tempting to abandon a safe pick and keep looking.

Chert brings an AI referee into the Group FaceTime call. The referee gives both players the same category, runs the round, scores what each player shows on camera, and reveals the winner. The target experience is two players and one referee in a single call.

## Player experience

1. **Challenge a friend.** Open Envoggle in the iMessage app drawer and send a branded **1v1 Challenge** card. The friend taps the card and selects **Accept Challenge**. Both players get the same round code in the invite. The hackathon build assumes the iMessage extension is installed on both demo phones.
2. **Join FaceTime.** After acceptance, a player starts Group FaceTime and brings in the other player and the Chert referee using the call flow verified on the assigned line. Accepting the card and starting the call are separate user actions. The host reads the round code to the referee so it can load the correct challenge. [Apple Messages framework](https://developer.apple.com/documentation/messages) · [Apple Group FaceTime](https://support.apple.com/guide/iphone/make-a-group-facetime-call-iph405ab67de/ios)
3. **Hunt for 20 seconds.** Once both players are ready and both rear cameras are on, the referee announces the category and starts the countdown. Both camera views stay visible on both phones. The referee displays the category and timer on its tile and calls out five seconds remaining. The first demo category is **Things that are blue**.
4. **Show your find.** At the buzzer, both players hold up or point at one object. The referee captures one fresh frame per player at the deadline, within a one-second capture window. The camera view at the buzzer is the submission. If a player has no clear object, their entry receives zero points. If the referee loses either camera feed, void the round and offer a restart.
5. **Reveal together.** The referee’s tile shows both objects, scores, and the winner at the same time. The referee reads a short explanation aloud. A tie is a draw. Either player can request a rematch in the same call, and the next round starts after both are ready.

## Scoring requirements

- **Check eligibility first.** Gemini identifies the object and checks it against the category. For **Things that are blue**, blue must be a prominent part of the object. A small blue logo on a white mug or a photo of a blue object displayed on a screen earns zero. An unclear image also earns zero with a short explanation.
- **Use fixed rarity tiers.** Eligible finds earn **1 point** for common, **3 points** for uncommon, or **5 points** for niche. Judge rarity against what someone would typically encounter around campus. A blue pen is common, blue binoculars are uncommon, and a blue violin is niche. These are example anchors for the game rubric.
- **Apply the same rubric to both frames.** Gemini returns an object label, eligibility, a rarity tier, and a short reason grounded in the frame and rubric. Envoggle maps the tier to points. Higher points win. If scoring fails or exceeds 10 seconds, offer a replay and record the round as void.

## Technical requirements and first test

- **Messages** · Use `MSMessage` and `MSMessageTemplateLayout` for the challenge card and `MSSession` for a follow-up acceptance card. Store an opaque round code with the invite and keep match state on the backend so reopening the card loads the current status. [Apple interactive messages](https://developer.apple.com/documentation/messages/mssession)
- **FaceTime and Chert** · FaceTime carries player video. A LiveKit agent connected through Chert handles the referee’s audio and scoreboard tile. The agent needs current, attributable frames from each player for scoring. Chert’s public docs describe a single `facetime-remote-video` track. Access to two independently attributable feeds in one group call is unverified. [Chert caller vision](https://docs.trychert.com/facetime-cli/video) · [Chert line setup](https://docs.trychert.com/facetime-cli/connect)
- **First test** · On the assigned video-enabled line, put two actual iPhones and the referee in one Group FaceTime call. Confirm on both phones that each player can see their own rear-camera preview and the opponent’s feed throughout the hunt. Show different objects simultaneously, then swap them, and confirm the agent captures and attributes both correctly without relying on who is speaking. Verify the referee’s timer and score are legible in the chosen FaceTime layout. Repeat across two calls on venue Wi-Fi.
- **Demo contingency** · If the group call or video bridge fails, preserve the two-way live duel with two equal camera tiles in a browser arena and a plain iMessage join link. Demo that as the Entertainment build. Treat Chert sponsor eligibility as unverified for the fallback.

## MVP acceptance and schedule

- **Invite** · Both demo phones can open the same challenge, accept it once, and resolve to the same round. A plain invite can substitute for the custom card if extension signing or installation threatens the demo.
- **Duel** · Both phones show both live feeds during a shared 20-second hunt. Both submissions come from the same deadline, are attributed correctly, and reveal together within 10 seconds. An invalid item, a tie, and a dropped feed produce the specified outcomes.
- **Scoring** · Test at least 12 sample captures across the three rarity tiers, invalid items, and blurry images. Repeat the batch and check that clear examples keep the same tier and that clearly invalid examples receive zero.
- **Friday** · Confirm group calling, caller-camera access, and the FaceTime layout first. Use the first two build hours as the go/no-go window for the FaceTime path.
- **Saturday** · Deliver one end-to-end round before polishing the invite. Test on the demo phones and record the two-minute submission video by Saturday evening. Submit by Sunday at 8 a.m. [Emory Hacks schedule](https://emoryhacks.com/#about) · [Submission requirements](https://emory-hacks-202.devpost.com/#requirements)
