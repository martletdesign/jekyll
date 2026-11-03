/* Framework-neutral progressive enhancement. No remote requests or persistent user data. */
(() => {
  'use strict';
  document.querySelectorAll('[data-demo-form]').forEach(form => {
    const status = form.querySelector('[data-form-status]'), fields = form.querySelector('[data-demo-fields]'), fallback = form.nextElementSibling;
    if (!status || !fields || !fallback?.matches('[data-form-fallback]')) return;
    const freeText = form.querySelectorAll('[name=name], [name=message]');
    const validateText = () => freeText.forEach(input => {
      const label = input.name === 'name' ? 'name' : 'message';
      input.setCustomValidity(input.value && !input.value.trim() ? `Enter a ${label} with at least one non-whitespace character.` : '');
    });
    // Whitespace is a custom rule, so expose its error inline instead of relying
    // on a browser popup which can obscure a subsequent pointer activation.
    let suppressNativePopup = false;
    const originalInvalid = new WeakMap();
    const clearWhitespace = () => freeText.forEach(input => {
      if (input.validity.customError) return;
      const error = form.querySelector(`[data-whitespace-error="${input.name}"]`);
      if (!error) return;
      const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== error.id);
      if (ids.length) input.setAttribute('aria-describedby', ids.join(' ')); else input.removeAttribute('aria-describedby');
      const oldInvalid = originalInvalid.get(input);
      if (oldInvalid === null) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', oldInvalid);
      originalInvalid.delete(input); error.remove();
    });
    const showWhitespace = input => {
      let error = form.querySelector(`[data-whitespace-error="${input.name}"]`);
      if (!error) {
        error = document.createElement('span'); error.id = `${input.id}-whitespace-error`;
        error.dataset.whitespaceError = input.name; error.setAttribute('role', 'alert');
        originalInvalid.set(input, input.getAttribute('aria-invalid'));
        input.insertAdjacentElement('afterend', error);
        input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
      }
      input.setAttribute('aria-invalid', 'true'); error.textContent = input.validationMessage;
    };
    form.addEventListener('submit', event => {
      event.preventDefault();
      validateText(); clearWhitespace();
      const firstInvalid = Array.from(form.elements).find(input => input.willValidate && !input.validity.valid);
      suppressNativePopup = !!firstInvalid?.validity?.customError;
      if (suppressNativePopup) showWhitespace(firstInvalid);
      const valid = form.reportValidity();
      suppressNativePopup = false;
      if (!valid) { if (firstInvalid?.validity?.customError) firstInvalid.focus(); return; }
      status.textContent = 'Example validated locally. Nothing was sent, saved, or authenticated.';
      // Do not retain even illustrative passwords or verification codes.
      form.querySelectorAll('[type=password], [name=code]').forEach(input => { input.value = ''; });
    });
    // Explicit reportValidity still emits a non-bubbling invalid event.
    form.addEventListener('invalid', event => { status.textContent = ''; if (suppressNativePopup) event.preventDefault(); }, true);
    // A validation message describes the submitted values, not later edits.
    form.addEventListener('input', () => { validateText(); clearWhitespace(); status.textContent = ''; });
    form.addEventListener('change', () => { validateText(); clearWhitespace(); status.textContent = ''; });
    form.addEventListener('reset', () => { freeText.forEach(input => input.setCustomValidity('')); clearWhitespace(); status.textContent = ''; });
    // Recheck custom errors at submission even if a host changed a value without
    // dispatching input. reportValidity above still enforces native constraints.
    form.noValidate = true; fields.disabled = false; fallback.hidden = true;
  });

  document.querySelectorAll('[data-listing]').forEach(listing => {
    const items = [...listing.querySelectorAll('[data-list-item]')];
    const size = Number(listing.dataset.pageSize);
    if (items.length <= size) return;
    const nav = listing.querySelector('nav');
    const previous = nav.querySelector('[data-previous]');
    const next = nav.querySelector('[data-next]');
    let page = 0;
    const render = () => {
      items.forEach((item, index) => { item.hidden = index < page * size || index >= (page + 1) * size; });
      previous.disabled = page === 0;
      next.disabled = (page + 1) * size >= items.length;
      nav.querySelector('[data-page-status]').textContent = `Page ${page + 1} of ${Math.ceil(items.length / size)}`;
    };
    previous.addEventListener('click', () => { page--; render(); if (previous.disabled) next.focus(); });
    next.addEventListener('click', () => { page++; render(); if (next.disabled) previous.focus(); });
    nav.hidden = false;
    render();
  });

  document.querySelectorAll('[data-example-search]').forEach(container => {
    const search = container.querySelector('.example-search');
    let index;
    try { index = JSON.parse(container.querySelector('[data-search-index]').textContent); if (!Array.isArray(index) || !index.every(entry => entry && ['title','summary','category','url'].every(key => typeof entry[key] === 'string'))) return; } catch { return; }
    const input = search.querySelector('input');
    const submit = search.querySelector('button[type="submit"]');
    const results = container.querySelector('[data-search-results]');
    const status = container.querySelector('[data-search-status]');
    const run = value => {
      const query = value.trim().slice(0, 200);
      input.value = query;
      results.replaceChildren();
      if (!query) { status.textContent = 'Enter a word or phrase to search the collection.'; return; }
      const words = query.toLocaleLowerCase().split(/\s+/u);
      const matches = index.filter(entry => words.every(word => `${entry.title} ${entry.summary} ${entry.category}`.toLocaleLowerCase().includes(word)));
      if (matches.length) status.textContent = `${matches.length} result${matches.length === 1 ? '' : 's'} for “${query}”.`;
      else {
        const browse = document.createElement('a');
        browse.href = container.dataset.browseUrl;
        browse.textContent = 'browse the example index';
        status.replaceChildren(document.createTextNode(`No results for “${query}”. Try fewer words or `), browse, document.createTextNode('.'));
      }
      for (const entry of matches) {
        const li = document.createElement('li');
        const body = document.createElement('div');
        const heading = document.createElement('h3');
        const anchor = document.createElement('a');
        anchor.href = entry.url;
        anchor.textContent = entry.title;
        heading.append(anchor);
        const summary = document.createElement('p');
        summary.textContent = entry.summary;
        body.append(heading, summary);
        li.append(body);
        results.append(li);
      }
    };
    const initial = (new URL(location.href).searchParams.get('q') || '').trim().slice(0, 200);
    const initialUrl = new URL(location.href);
    initial ? initialUrl.searchParams.set('q', initial) : initialUrl.searchParams.delete('q');
    try { history.replaceState(history.state, '', initialUrl); } catch { return; }
    window.addEventListener('nightjar:search-query', event => {
      run(event.detail.value);
      if (!event.detail.urlUpdated) status.append(document.createTextNode(' The address could not be updated; it may not reflect this search.'));
    });
    window.addEventListener('popstate', () => run(new URL(location.href).searchParams.get('q') || ''));
    search.addEventListener('submit', event => {
      event.preventDefault();
      const query = input.value.trim().slice(0, 200), url = new URL(location.href);
      query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
      let urlUpdated = true;
      try { history.replaceState(history.state, '', url); } catch { urlUpdated = false; }
      window.dispatchEvent(new CustomEvent('nightjar:search-query', {detail: {value: query, urlUpdated}}));
    });
    run(initial);
    input.disabled = false; submit.disabled = false; container.querySelector('[data-search-fallback]').hidden = true;
  });

  document.querySelectorAll('[data-gallery]').forEach(gallery => {
    const dialog = gallery.querySelector('.example-lightbox');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    let opener = null;
    gallery.querySelectorAll('[data-enlarge]').forEach(anchor => anchor.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const image = dialog.querySelector('img');
      image.src = anchor.href;
      image.alt = anchor.querySelector('img').alt;
      dialog.querySelector('figcaption').textContent = anchor.dataset.caption;
      try { dialog.showModal(); } catch { return; }
      event.preventDefault();
      opener = anchor;
    }));
    dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      if (dialog.open) return;
      const active = document.activeElement;
      if (opener?.isConnected && (!active || active === document.body || active === document.documentElement || dialog.contains(active))) opener.focus();
    });
  });

  document.querySelectorAll('[data-workspace]').forEach(workspace => {
    const records = [...workspace.querySelectorAll('[data-record]')];
    const filter = workspace.querySelector('[data-record-filter]');
    const review = workspace.querySelector('[data-review-record]');
    const reset = workspace.querySelector('[data-reset-workspace]');
    const detail = workspace.querySelector('[data-active-record]');
    const status = workspace.querySelector('[data-workspace-status]');
    const original = records.map(record => record.querySelector('.example-tag').textContent);
    let active = null;
    const count = () => {
      workspace.querySelector('[data-record-count]').textContent = `${records.filter(record => !record.hidden).length} of ${records.length} records shown.`;
    };
    const select = record => {
      active = record;
      records.forEach(item => item.querySelector('button').setAttribute('aria-pressed', String(item === active)));
      detail.replaceChildren();
      for (const source of record.querySelectorAll('button, p, .example-tag')) {
        const p = document.createElement('p');
        p.textContent = source.textContent;
        detail.append(p);
      }
      review.disabled = false;
      status.textContent = `Selected ${record.querySelector('button').textContent}. Changes affect this preview only.`;
    };
    records.forEach(record => {
      const button = record.querySelector('button');
      button.disabled = false;
      button.addEventListener('click', () => select(record));
    });
    filter.disabled = false;
    reset.disabled = false;
    const matches = (record, query) => {
      const fields = [record.querySelector('[data-select-record]').textContent, record.querySelector('.example-tag').textContent, record.querySelector('[data-record-summary]').textContent, record.dataset.recordId, record.dataset.recordOwner];
      return fields.join(' ').toLocaleLowerCase().includes(query) || record.textContent.toLocaleLowerCase().includes(query);
    };
    const applyFilter = () => {
      const query = filter.value.trim().toLocaleLowerCase();
      records.forEach(record => { record.hidden = !matches(record, query); });
      count();
      if (active?.hidden) {
        active.querySelector('button').setAttribute('aria-pressed', 'false');
        active = null;
        detail.textContent = 'The selected record is outside this filter. Select a visible record.';
        review.disabled = true;
      }
    };
    filter.addEventListener('input', applyFilter);
    review.addEventListener('click', () => {
      if (!active) return;
      active.querySelector('.example-tag').textContent = 'Reviewed locally';
      select(active); applyFilter();
      if (!active) { status.textContent = 'Marked reviewed in page memory. The record no longer matches this filter. No server record was changed.'; filter.focus(); }
      else status.textContent = 'Marked reviewed in page memory. No server record was changed.';
    });
    reset.addEventListener('click', () => {
      records.forEach((record, i) => { record.querySelector('.example-tag').textContent = original[i]; record.hidden = false; record.querySelector('button').setAttribute('aria-pressed', 'false'); });
      active = null; filter.value = ''; detail.textContent = 'Select a record to inspect it.'; review.disabled = true;
      status.textContent = 'Demonstration reset. No changes were saved.';
      count();
    });
    count();
  });

  document.querySelectorAll('[data-conversation]').forEach(conversation => {
    const chat = conversation.querySelector('[data-chat]');
    if (!chat) return;
    const messages = conversation.querySelector('[data-messages]');
    const input = chat.querySelector('textarea');
    const status = chat.querySelector('[data-chat-status]');
    const fields = chat.querySelector('[data-demo-fields]'), reset = chat.querySelector('[data-clear-chat]'), fallback = conversation.querySelector('[data-chat-fallback]');
    if (!messages || !input || !status || !fields || !reset || !fallback) return;
    const original = [...messages.children].map(node => node.cloneNode(true));
    chat.addEventListener('submit', event => {
      event.preventDefault();
      if (!input.value.trim()) { input.setCustomValidity('Enter a message before adding it.'); input.reportValidity(); return; }
      const item = document.createElement('li');
      const name = document.createElement('strong'); name.textContent = 'You · Local preview';
      const text = document.createElement('p'); text.textContent = input.value.trim();
      item.append(name, text); messages.append(item); input.value = '';
      status.textContent = 'Added to this preview. Not sent to anyone; cleared when you leave or reload.';
      input.focus();
    });
    input.addEventListener('input', () => { input.setCustomValidity(''); const neutral = 'Messages remain in page memory. Nothing is delivered.'; if (status.textContent !== neutral) status.textContent = neutral; });
    input.addEventListener('invalid', () => { status.textContent = input.validity.valueMissing || input.validity.customError ? 'Enter a message before adding it.' : 'Check the message and try again.'; });
    reset.addEventListener('click', () => {
      messages.replaceChildren(...original.map(node => node.cloneNode(true)));
      input.value = ''; input.setCustomValidity(''); status.textContent = 'Conversation reset. Nothing was delivered.';
    });
    fields.disabled = false; fallback.hidden = true;
  });

  document.querySelectorAll('[data-sensors]').forEach(sensors => {
    const mode = sensors.querySelector('select'); const ventilation = sensors.querySelector('input');
    mode.disabled = false; ventilation.disabled = false;
    const update = () => {
      sensors.querySelector('[data-temperature]').textContent = `${mode.value} °C`;
      sensors.querySelector('[data-sensor-status]').textContent = `Simulation updated. Preview ventilation ${ventilation.checked ? 'enabled' : 'disabled'}. No real device is connected.`;
    };
    mode.addEventListener('change', update); ventilation.addEventListener('change', update);
  });
  document.querySelectorAll('[data-scene]').forEach(scene => {
    const select = scene.querySelector('select'); const image = scene.querySelector('img');
    const views = { coast: 'Illustrated coastline with observation markers.', station: 'Stylised field station beside water.', notebook: 'An open field notebook with observation lines.' };
    select.disabled = false;
    select.addEventListener('change', () => {
      if (!Object.hasOwn(views, select.value)) return;
      image.src = new URL(`${select.value}.svg`, image.src).href;
      image.alt = views[select.value];
      scene.querySelector('[data-scene-caption]').textContent = `${select.selectedOptions[0].textContent} · Original fictional illustration.`;
      scene.querySelector('[data-scene-status]').textContent = `Showing ${select.selectedOptions[0].textContent}. No immersive device is connected.`;
    });
  });
})();
