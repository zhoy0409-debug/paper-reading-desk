(() => {
  'use strict';
  const element = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };
  function button(className, action) {
    const node = element('button', className);
    node.type = 'button';
    node.onclick = action;
    return node;
  }

  function mount(host, {describe, move, remove, edit, crop, exportPpt, session}) {
    const t = (zh, en) => window.ReaderLanguage.choose(zh, en);
    const dock = element('section', 'slide-basket');
    const header = element('div', 'basket-header');
    const toggle = button('basket-toggle', () => { expanded = !expanded; layout(); });
    const title = element('strong'), count = element('span', 'basket-count');
    const chevron = element('span', 'basket-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    toggle.append(title, count, chevron);
    const status = element('span', 'basket-status');
    status.setAttribute('role', 'status');
    const download = button('basket-export', exportPpt);
    const list = element('ol', 'basket-list');
    list.id = 'basket-' + crypto.randomUUID();
    toggle.setAttribute('aria-controls', list.id);
    header.append(toggle, status, download);
    dock.append(header, list);
    dock.hidden = true;
    host.append(dock);

    let expanded = true, keys = [], drag = null, frame = 0, disposed = false;
    const cards = new Map();
    const spacer = new ResizeObserver(() => {
      host.style.setProperty('--basket-space', dock.hidden ? '0px' : (dock.offsetHeight + 18) + 'px');
    });
    spacer.observe(dock);
    const visible = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const card = cards.get(entry.target.dataset.key);
        if (card && entry.isIntersecting) drawThumbnail(card);
      }
    }, {root:list});
    function layout() {
      dock.hidden = !keys.length;
      list.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      chevron.textContent = expanded ? '▾' : '▴';
    }
    function clearTarget() {
      list.querySelector('.basket-drop')?.classList.remove('basket-drop');
    }
    function findTarget() {
      const hit = document.elementFromPoint(drag.x, drag.y)?.closest('.basket-card');
      return hit?.parentElement === list ? hit : null;
    }
    function track() {
      if (!drag) return;
      const rect = list.getBoundingClientRect();
      if (drag.y >= rect.top && drag.y <= rect.bottom) {
        if (drag.x < rect.left + 30) list.scrollLeft -= 12;
        else if (drag.x > rect.right - 30) list.scrollLeft += 12;
      }
      clearTarget();
      const hit = findTarget();
      if (hit && hit.dataset.key !== drag.key) hit.classList.add('basket-drop');
      frame = requestAnimationFrame(track);
    }
    function endDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const {key} = drag;
      drag.x = event.clientX; drag.y = event.clientY;
      const target = event.type === 'pointerup' && findTarget();
      drag = null;
      cancelAnimationFrame(frame);
      clearTarget();
      cards.get(key)?.node.classList.remove('basket-dragging');
      if (target) move(key, keys.indexOf(target.dataset.key));
    }
    function makeCard(key) {
      const node = element('li', 'basket-card');
      node.dataset.key = key;
      const grip = button('basket-grip', null);
      grip.textContent = '⠿';
      grip.onpointerdown = event => {
        if (event.button !== 0 || drag) return;
        event.preventDefault();
        grip.setPointerCapture(event.pointerId);
        drag = {id:event.pointerId, key, x:event.clientX, y:event.clientY};
        node.classList.add('basket-dragging');
        track();
      };
      grip.onpointermove = event => {
        if (drag?.id === event.pointerId) { drag.x = event.clientX; drag.y = event.clientY; }
      };
      grip.onpointerup = grip.onpointercancel = grip.onlostpointercapture = endDrag;
      grip.onkeydown = event => {
        const delta = {ArrowLeft:-1, ArrowRight:1}[event.key];
        if (delta) {
          event.preventDefault();
          move(key, keys.indexOf(key) + delta);
          grip.focus({preventScroll:true});
          node.scrollIntoView({block:'nearest', inline:'nearest'});
        }
      };
      const ordinal = element('span','basket-ordinal'), name = element('strong','basket-name');
      const del = button('basket-remove', () => {
        const index = keys.indexOf(key);
        remove(key);
        (cards.get(keys[index] || keys[index - 1])?.del || host.querySelector('.rq-add-slide'))?.focus({preventScroll:true});
      });
      del.textContent = '×';
      const adjust=button('basket-crop',()=>crop(key));
      const row = element('div', 'basket-card-head'); row.append(grip, ordinal, name, adjust, del);
      const thumb = element('canvas','basket-thumb'), fallback = element('small', 'basket-missing');
      fallback.hidden = true;
      thumb.setAttribute('aria-hidden','true');
      const note = element('textarea','basket-note');
      note.rows = 2; note.maxLength = 480;
      note.oninput = () => { status.textContent = ''; edit(key, note.value); };
      const body = element('div','basket-card-body'); body.append(thumb, fallback, note); node.append(row, body);
      visible.observe(node);
      return {node, grip, ordinal, name, adjust, del, thumb, fallback, note};
    }

    async function drawThumbnail(card) {
      const {item, signature} = card;
      if (!item.box || card.drawn === signature) return;
      card.drawn = signature;
      try {
        const pic = await session.renderRegion(item.figure.page, item.box, {quality:'thumbnail'});
        if (disposed || !card.node.isConnected || card.signature !== signature) return;
        if (pic.mode !== 'crop') throw Error('Empty crop');
        const image = await createImageBitmap(pic.blob);
        try {
          if (disposed || !card.node.isConnected || card.signature !== signature) return;
          const surface = PaperPanelLabels.draw(image, item.recipe);
          card.thumb.width = surface.width; card.thumb.height = surface.height;
          card.thumb.getContext('2d').drawImage(surface, 0, 0);
          card.thumb.dataset.ready = 'true';
          card.thumb.hidden = false; card.fallback.hidden = true;
        } finally { image.close(); }
      } catch {
        if (card.signature === signature && !disposed) {
          card.drawn = null; card.thumb.hidden = true; card.fallback.hidden = false;
        }
      }
    }
    function sync(queue, busy) {
      const fresh = !keys.length && queue.length;
      if (keys.length !== queue.length || keys.some((key, i) => key !== queue[i])) status.textContent = '';
      keys = [...queue];
      if (fresh) expanded = true;
      for (const [key, card] of cards) {
        if (!keys.includes(key)) { visible.unobserve(card.node); card.node.remove(); cards.delete(key); }
      }
      keys.forEach((key, index) => {
        const item = describe(key);
        const card = cards.get(key) || makeCard(key);
        cards.set(key, card);
        if (list.children[index] !== card.node) list.insertBefore(card.node, list.children[index] || null);
        const label = item.name;
        card.ordinal.textContent = String(index + 1);
        card.name.textContent = label;
        card.adjust.textContent=t('裁切','Crop');
        card.adjust.setAttribute('aria-label',t('调整裁切 ','Adjust crop for ')+label);
        card.grip.title = t('拖动排序，或用左右方向键移动', 'Drag to reorder, or use the left and right arrow keys');
        card.grip.setAttribute('aria-label', t('调整顺序 ','Reorder ') + label);
        card.del.setAttribute('aria-label', t('移除 ','Remove ') + label);
        card.note.setAttribute('aria-label', label + t(' 的讲解',' narration'));
        card.note.placeholder = t('写下这张图的讲解…','Add a speaking note…');
        if (card.note.value !== item.sentence) card.note.value = item.sentence;
        card.fallback.textContent = t('暂无预览', 'No preview');
        const signature = JSON.stringify([item.figure?.page, item.box, item.recipe]);
        if (signature !== card.signature) {
          card.signature = signature; card.item = item; delete card.thumb.dataset.ready;
          card.thumb.width = 1;
          card.thumb.hidden = !item.box; card.fallback.hidden = !!item.box;
          visible.unobserve(card.node); visible.observe(card.node);
        }
      });
      title.textContent = t('汇报篮','Slide basket');
      count.textContent = String(keys.length);
      dock.setAttribute('aria-label', title.textContent);
      download.textContent = busy ? t('正在导出…','Exporting…') : t('导出所选图','Export selected figures');
      download.disabled = busy || !keys.length;
      layout();
    }
    return {
      sync,
      reveal(key) {
        expanded = true; layout();
        const card = cards.get(key);
        if (card) list.scrollLeft = Math.max(0, card.node.offsetLeft + card.node.offsetWidth - list.clientWidth + 12);
      },
      setNote(key, text) {
        status.textContent = '';
        const card = cards.get(key);
        if (card && card.note.value !== text) card.note.value = text;
      },
      message(text) { status.textContent = text; },
      destroy() { disposed = true; drag = null; cancelAnimationFrame(frame); visible.disconnect(); spacer.disconnect(); dock.remove(); }
    };
  }
  window.SlideBasket = {mount};
})();
