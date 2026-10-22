// main.js
// Entry point for the Spotter's Light Planner (loaded by index.html after the Light Scout app).
// Shows the tab bar and starts the planner the first time its tab is opened.

import { setLangSource } from './i18n.js';

function init() {
  const LS = window.LightScout;
  if (!LS) return; // Light Scout didn't start (should not happen)
  setLangSource(LS.lang);
  const tabs = document.getElementById('tabs');
  const views = { light: document.getElementById('viewLight'), planner: document.getElementById('viewPlanner') };
  const buttons = { light: document.getElementById('tabLight'), planner: document.getElementById('tabPlanner') };
  tabs.hidden = false;

  async function show(name) {
    for (const k of Object.keys(views)) {
      views[k].hidden = k !== name;
      buttons[k].setAttribute('aria-selected', String(k === name));
    }
    LS.store.set('planner:tab', name);
    if (name === 'planner') {
      // Load the planner code only when needed, so the Light tab starts as fast as before.
      const [{ startPlanner, addCard, ctx }, wind, conditions, traffic] = await Promise.all([
        import('./ui.js'), import('./windCard.js'), import('./conditionsCard.js'), import('./trafficCard.js'),
      ]);
      if (!init.cardsAdded) {
        init.cardsAdded = true;
        // Order matters: the wind card shares the METAR and runway estimate with the conditions card.
        addCard(wind.windCard(ctx));
        addCard(conditions.conditionsCard(ctx));
        addCard(traffic.trafficCard(ctx));
      }
      await startPlanner(views.planner);
    }
  }
  buttons.light.onclick = () => show('light');
  buttons.planner.onclick = () => show('planner');
  if (LS.store.get('planner:tab', 'light') === 'planner') show('planner');
}

if (window.LightScout) init();
else document.addEventListener('lightscout-ready', init, { once: true });
