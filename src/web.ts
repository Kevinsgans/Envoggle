import { Room, RoomEvent, Track, createLocalVideoTrack, type LocalVideoTrack } from 'livekit-client';
import type { Duel } from './duel.js';
import { FOCUS_MS, PHOTO_HEIGHT, focusProgress, photoMotion, renderPhoto, scanProgress, type Photo } from './find-visual.js';
import { COUNT_UP_MS, countUpScore, renderScore, scoreDigits } from './score-display.js';

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
let joining: Promise<void> | undefined;
let clockOffset = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
type FindCard = { article: HTMLElement; image: HTMLDivElement; score: HTMLDivElement; caption: HTMLElement; reason: HTMLParagraphElement; shownPoints?: number; photo?: Photo; drawing?: string; pending?: boolean; retryAt?: number };
let findStage: { id: string; title: HTMLHeadingElement; cards: FindCard[] } | undefined;
let findAnimation = 0;

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

function clearFinds() {
  if (!findStage) return;
  cancelAnimationFrame(findAnimation);
  findAnimation = 0;
  findStage.cards.forEach(({ photo }) => { if (photo) URL.revokeObjectURL(photo.href); });
  findStage = undefined;
  element('results').replaceChildren();
}

function animateFinds() {
  findAnimation = 0;
  if (!state || !findStage) return;
  const { presentation } = state;
  const now = Date.now() + clockOffset;
  const focusAt = presentation?.focusStartedAt;
  const scoring = state.phase === 'scoring';
  const countUp = scoring ? presentation?.countUp : undefined;
  const elapsedCount = countUp ? now - countUp.startedAt : undefined;
  const scan = scoring && focusAt === undefined && !reducedMotion.matches ? presentation : undefined;
  const focus = !scoring || countUp || (focusAt !== undefined && reducedMotion.matches)
    ? 1 : focusAt === undefined ? 0 : focusProgress(now - focusAt);

  findStage.cards.forEach((card, slot) => {
    const target = countUp?.targets[slot];
    if (elapsedCount !== undefined && target != null) {
      const points = reducedMotion.matches ? undefined : Math.max(card.shownPoints ?? 0, countUpScore(elapsedCount, target));
      const motion = points === undefined ? 'static' : 'counting';
      if (card.score.dataset.motion !== motion) {
        card.score.innerHTML = renderScore(points);
        card.score.dataset.motion = motion;
        card.score.hidden = false;
      } else if (points !== undefined && points !== card.shownPoints) {
        const digits = scoreDigits(points);
        card.score.querySelectorAll('text').forEach((digit, column) => { digit.textContent = digits[column]; });
      }
      if (points !== undefined) card.shownPoints = points;
    }
    if (!card.photo) return;
    const geometry = presentation?.finds?.[slot] ?? undefined;
    const mode = scan ? 'scan' : geometry ? 'focus' : 'photo';
    if (card.drawing !== mode) {
      card.image.innerHTML = renderPhoto(`find-${slot}`, card.photo, geometry, focus, scan ? scanProgress(now - scan.scanStartedAt) : undefined);
      card.drawing = mode;
    }
    if (scan) {
      card.image.querySelector('[data-beam]')?.setAttribute('transform', `translate(0 ${scanProgress(now - scan.scanStartedAt) * PHOTO_HEIGHT})`);
    } else if (geometry) {
      const motion = photoMotion(card.photo, geometry, focus);
      card.image.querySelector('[data-photo]')?.setAttribute('transform', motion.transform);
      card.image.querySelector('[data-background]')?.setAttribute('opacity', String(motion.background));
      const outline = card.image.querySelector('[data-outline]');
      outline?.setAttribute('opacity', String(focus));
      outline?.setAttribute('stroke-width', String(motion.stroke));
    }
  });
  if (scan || (scoring && !reducedMotion.matches &&
    (elapsedCount !== undefined ? elapsedCount < COUNT_UP_MS : focusAt !== undefined && now < focusAt + FOCUS_MS))) {
    findAnimation = requestAnimationFrame(animateFinds);
  }
}

function scheduleFindAnimation() {
  if (!findAnimation) findAnimation = requestAnimationFrame(animateFinds);
}

async function loadFindPhoto(card: FindCard, slot: number, round: number) {
  const stage = findStage;
  card.pending = true;
  let href: string | undefined;
  try {
    const response = await fetch(`/api/duels/${code}/frame?player=${slot}&round=${round}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok || stage !== findStage) return;
    href = URL.createObjectURL(await response.blob());
    const image = new Image();
    image.src = href;
    await image.decode();
    if (stage !== findStage) return;
    card.photo = { href, width: image.naturalWidth, height: image.naturalHeight };
    href = undefined;
    scheduleFindAnimation();
  } catch {
    // The next state poll can retry a frame that failed to load.
  } finally {
    if (href) URL.revokeObjectURL(href);
    card.pending = false;
    card.retryAt = Date.now() + 1000;
  }
}

function renderFinds(current: State) {
  if (current.phase !== 'scoring' && current.phase !== 'result') return clearFinds();
  const id = `${code}:${current.round}`;
  if (findStage?.id !== id) {
    clearFinds();
    const title = document.createElement('h2');
    const grid = document.createElement('div');
    grid.className = 'result-grid';
    const cards = current.locked.map((locked, slot): FindCard => {
      const article = document.createElement('article');
      article.className = `result ${slot === 0 ? 'orange-result' : 'blue-result'}`;
      const name = document.createElement('h3');
      name.textContent = slot === current.slot ? 'You' : 'Opponent';
      const image = document.createElement('div');
      image.className = 'result-photo';
      image.setAttribute('role', 'img');
      image.setAttribute('aria-label', locked ? 'Locked photo' : 'No frame');
      image.textContent = locked ? 'Loading frame…' : 'No frame';
      const score = document.createElement('div');
      score.className = 'result-score';
      score.hidden = true;
      score.setAttribute('aria-hidden', 'true');
      const caption = document.createElement('strong');
      const reason = document.createElement('p');
      article.append(image, name, score, caption, reason);
      return { article, image, score, caption, reason };
    });
    grid.append(cards[current.slot].article, cards[1 - current.slot].article);
    element('results').append(title, grid);
    findStage = { id, title, cards };
  }

  const results = current.results;
  const margin = results ? results[current.slot].points - results[1 - current.slot].points : undefined;
  const heading = margin === undefined ? 'Scoring' : margin === 0 ? 'Draw' : margin > 0 ? 'You win' : 'Opponent wins';
  if (findStage.title.textContent !== heading) findStage.title.textContent = heading;
  findStage.cards.forEach((card, slot) => {
    const result = results?.[slot];
    if (result && !card.caption.textContent) {
      card.score.innerHTML = renderScore(result.points);
      delete card.score.dataset.motion;
      card.score.hidden = false;
      card.score.removeAttribute('aria-hidden');
      card.score.setAttribute('role', 'img');
      card.score.setAttribute('aria-label', `${result.points} ${result.points === 1 ? 'point' : 'points'}`);
      card.caption.textContent = result.label;
      card.reason.textContent = result.reason;
      if (current.locked[slot]) card.image.setAttribute('aria-label', result.label);
    }
    if (current.locked[slot] && !card.photo && !card.pending && Date.now() >= (card.retryAt ?? 0)) {
      void loadFindPhoto(card, slot, current.round);
    }
  });
  scheduleFindAnimation();
}

function render(current: State) {
  if (state && current.serverTime < state.serverTime) return;
  state = current;
  clockOffset = current.serverTime - Date.now();
  element('arena').hidden = false;
  element('feeds').hidden = current.phase === 'scoring' || current.phase === 'result';
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

  renderFinds(current);
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
