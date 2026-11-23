'use strict';
const film = document.querySelector('video');
const language = document.querySelector('[data-language]');
const updateLanguageLink = () => { language.hash = location.hash; };
updateLanguageLink();
window.addEventListener('hashchange', updateLanguageLink);

const player = document.createElement('div');
player.className = 'player';
film.before(player);
player.append(film);
const playButton = document.createElement('button');
playButton.type = 'button';
playButton.setAttribute('aria-label', document.documentElement.lang === 'en' ? 'Play the film' : '播放宣传片');
player.append(playButton);
playButton.addEventListener('click', () => { film.play().catch(() => film.focus()); });
film.addEventListener('play', () => { playButton.hidden = true; });
film.addEventListener('ended', () => { playButton.hidden = false; });

document.querySelector('.transcript').addEventListener('click', async event => {
  const cue = event.target.closest('button[data-t]');
  if (!cue) return;
  if (!film.readyState) {
    await new Promise(resolve => film.addEventListener('loadedmetadata', resolve, {once: true}));
  }
  film.currentTime = Number(cue.dataset.t);
  film.scrollIntoView({block:'center'});
  film.focus({preventScroll:true});
  film.play().catch(() => {});
});
