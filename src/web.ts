import { Room, RoomEvent, Track, createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client';
import type { Duel } from './duel.js';

type State = ReturnType<Duel['state']>;
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => element<HTMLButtonElement>(id);
const room = new Room();
const codeFromUrl = new URL(location.href).searchParams.get('duel');
let code = codeFromUrl ?? '';
let token = code ? sessionStorage.getItem(`envoggle-${code}`) ?? '' : '';
let state: State | undefined;
let camera: LocalVideoTrack | undefined;
let local: HTMLVideoElement | undefined;
let remote: HTMLVideoElement | undefined;
let renderedChoices = '';
let renderedResults = '';
let joining: Promise<void> | undefined;
let clockOffset = 0;

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`/api/duels${path}`, { ...init, headers });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error);
  return payload;
}

function post(action: string, body: unknown = {}) {
  return request(`/${code}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

function report(error: unknown) {
  const notice = element('error');
  notice.textContent = error instanceof Error ? error.message : 'Try again.';
  notice.hidden = false;
}

function cameraReady(video?: HTMLVideoElement) {
  return Boolean(video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth);
}

function remember(data: { code: string; token: string }) {
  code = data.code;
  token = data.token;
  sessionStorage.setItem(`envoggle-${code}`, token);
  history.replaceState(null, '', `?duel=${code}`);
}

room.on(RoomEvent.TrackSubscribed, track => {
  if (track.kind !== Track.Kind.Video) return;
  remote = track.attach() as HTMLVideoElement;
  remote.playsInline = true;
  remote.muted = true;
  element('remote').replaceChildren(remote);
});
room.on(RoomEvent.TrackUnsubscribed, track => {
  track.detach().forEach(video => video.remove());
  if (track.kind === Track.Kind.Video) {
    remote = undefined;
    if (state && ['hunt', 'lobby', 'result', 'void'].includes(state.phase)) void post('drop').catch(report);
  }
});
room.on(RoomEvent.Disconnected, () => {
  joining = undefined;
  local = undefined;
  remote = undefined;
  element('local').replaceChildren();
  element('remote').replaceChildren();
  button('camera').hidden = false;
  if (state && ['hunt', 'lobby', 'result', 'void'].includes(state.phase)) void post('drop').catch(report);
});

function joinMedia() {
  joining ??= (async () => {
    button('camera').hidden = true;
    const media = await request(`/${code}/media`);
    await room.connect(media.url, media.token);
    try {
      camera = await createLocalVideoTrack({ facingMode: 'environment' });
      local = camera.attach() as HTMLVideoElement;
      local.muted = true;
      local.playsInline = true;
      element('local').replaceChildren(local);
      await room.localParticipant.publishTrack(camera, { source: Track.Source.Camera });
      element('error').hidden = true;
      camera.mediaStreamTrack.addEventListener('ended', () => {
        void room.disconnect();
      });
    } catch (error) {
      camera?.stop();
      await room.disconnect();
      throw error;
    }
  })().catch(error => {
    joining = undefined;
    button('camera').hidden = false;
    throw error;
  });
  return joining;
}

function actionButton(text: string, onClick: () => void) {
  const control = document.createElement('button');
  control.textContent = text;
  control.onclick = onClick;
  return control;
}

function render(current: State) {
  if (state && current.serverTime < state.serverTime) return;
  state = current;
  clockOffset = current.serverTime - Date.now();
  element('arena').hidden = false;
  element('prompt').textContent = current.prompt;
  updateClock();
  button('lock').hidden = current.phase !== 'hunt';
  button('lock').textContent = current.locked[current.slot] ? 'Replace locked frame' : 'Lock it in';
  const canReady = ['lobby', 'result', 'void'].includes(current.phase);
  button('ready').hidden = !canReady;
  button('ready').disabled = !current.accepted || current.ready[current.slot] || !cameraReady(local) || !cameraReady(remote);
  button('ready').textContent = current.ready[current.slot] ? 'Waiting for opponent' : current.phase === 'lobby' ? 'Ready' : 'Ready for rematch';
  element('consent').hidden = !current.retentionEnabled || !canReady || current.ready[current.slot];
  element('localLabel').textContent = current.locked[current.slot] ? 'You · Locked in' : 'You';
  element('remoteLabel').textContent = current.locked[1 - current.slot] ? 'Opponent · Locked in' : 'Opponent';
  element('status').textContent = current.message || ({
    lobby: current.accepted ? 'Turn on both cameras and ready up.' : 'Send the invite to your opponent.',
    hunt: 'Find an object and lock in your best shot.',
    confirm: current.confirmed ? 'Waiting for your opponent.' : current.guesses?.length ? 'Confirm what you found.' : 'The referee is identifying the finds.',
    scoring: 'Scoring the locked finds.',
    result: 'Round complete.',
    void: 'Round ended.',
  })[current.phase];

  const choices = JSON.stringify([current.round, current.phase, current.guesses, current.options, current.confirmed]);
  if (choices !== renderedChoices) {
    renderedChoices = choices;
    const region = element('choices');
    region.replaceChildren();
    const submit = (action: string, value?: string) => void post('confirm', { action, value }).then(render).catch(report);
    if (current.phase === 'confirm' && !current.confirmed && current.guesses?.length) {
      if (!current.options) {
        region.append(actionButton(`Yes, ${current.guesses[0]}`, () => submit('accept')),
          actionButton('Try another guess', () => submit('reject')));
      } else {
        current.guesses.forEach(guess => region.append(actionButton(guess, () => submit('choose', guess))));
        const custom = document.createElement('input');
        custom.type = 'text';
        custom.maxLength = 64;
        custom.placeholder = 'Your item name';
        custom.setAttribute('aria-label', 'Your item name');
        const form = document.createElement('form');
        form.hidden = true;
        form.append(custom, actionButton('Confirm name', () => {}));
        form.onsubmit = event => { event.preventDefault(); if (custom.value.trim()) submit('custom', custom.value); };
        region.append(actionButton('None of these', () => { form.hidden = false; custom.focus(); }), form);
      }
      region.append(actionButton('Skip entry', () => submit('skip')));
    }
  }

  const results = JSON.stringify([current.round, current.results]);
  if (results !== renderedResults) {
    renderedResults = results;
    const region = element('results');
    region.replaceChildren();
    if (current.results) {
      const outcome = current.results[current.slot].points - current.results[1 - current.slot].points;
      const title = document.createElement('h2');
      title.textContent = outcome === 0 ? 'Draw' : outcome > 0 ? 'You win' : 'Opponent wins';
      const grid = document.createElement('div');
      grid.className = 'result-grid';
      for (const slot of [current.slot, 1 - current.slot]) {
        const score = current.results[slot];
        const card = document.createElement('article');
        card.className = 'result';
        const caption = document.createElement('strong');
        caption.textContent = `${score.label} · ${score.points} pts`;
        const reason = document.createElement('p');
        reason.textContent = score.reason;
        void fetch(`/api/duels/${code}/frame?player=${slot}`, { headers: { Authorization: `Bearer ${token}` } })
          .then(response => response.ok ? response.blob() : undefined).then(blob => {
            if (!blob) return;
            const image = document.createElement('img');
            image.alt = score.label;
            const url = URL.createObjectURL(blob);
            image.onload = image.onerror = () => URL.revokeObjectURL(url);
            image.src = url;
            card.prepend(image);
          }).catch(() => {});
        card.append(caption, reason);
        grid.append(card);
      }
      region.append(title, grid);
    }
  }
}

function updateClock() {
  element('clock').textContent = state?.phase === 'hunt'
    ? String(Math.max(0, Math.ceil((state.deadline - Date.now() - clockOffset) / 1000))) : '';
}

let polling = false;
async function refresh() {
  if (!token || polling) return;
  polling = true;
  try { render(await request(`/${code}/state`)); }
  catch (error) { report(error); }
  finally { polling = false; }
}

button('create').onclick = async () => {
  try {
    remember(await request('', { method: 'POST' }));
    button('create').hidden = true;
    button('share').hidden = false;
    await joinMedia();
    await refresh();
  } catch (error) { report(error); }
};
button('accept').onclick = async () => {
  try {
    remember(await post('accept'));
    button('accept').hidden = true;
    await joinMedia();
    await refresh();
  } catch (error) { report(error); }
};
button('share').onclick = async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    button('share').textContent = 'Invite copied';
  } catch { report(new Error('Copy the invite from the address bar.')); }
};
button('camera').onclick = () => void joinMedia().then(refresh).catch(report);
button('ready').onclick = async () => {
  try { render(await post('ready', { retain: element<HTMLInputElement>('retain').checked })); } catch (error) { report(error); }
};
button('lock').onclick = async () => {
  if (!state || !local || !cameraReady(local)) return;
  const round = state.round;
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 720 / Math.max(local.videoWidth, local.videoHeight));
  canvas.width = Math.round(local.videoWidth * scale);
  canvas.height = Math.round(local.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(local, 0, 0, canvas.width, canvas.height);
  const frame = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .82));
  if (!frame) return;
  try {
    render(await request(`/${code}/lock?round=${round}`, { method: 'POST', body: frame }));
    element('error').hidden = true;
  } catch (error) { report(error); }
};

if (code) {
  button('create').hidden = true;
  button('accept').hidden = Boolean(token);
  if (token) {
    button('share').hidden = false;
    void joinMedia().then(refresh).catch(report);
  } else element('status').textContent = 'You’ve been challenged to a duel.';
}
setInterval(() => void refresh(), 350);
setInterval(updateClock, 100);
