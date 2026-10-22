// positions.js
// YOUR spotting positions, per airport. The app never suggests positions: it only stores what you add.
// Saved with Light Scout's own storage helper (localStorage, this browser only).

const KEY = 'planner:positions'; // { [airportIdent]: [{ id, name, lat, lon }] }
const SEL = 'planner:selected'; // { [airportIdent]: id }

export function makePositions(store) {
  const all = () => store.get(KEY, {});
  const save = (data) => store.set(KEY, data);
  return {
    list: (airport) => all()[airport] ?? [],
    add(airport, { name, lat, lon }) {
      const data = all();
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      data[airport] = [...(data[airport] ?? []), { id, name: String(name).slice(0, 60), lat: +lat.toFixed(6), lon: +lon.toFixed(6) }];
      save(data);
      this.select(airport, id);
      return id;
    },
    update(airport, id, changes) {
      const data = all();
      data[airport] = (data[airport] ?? []).map((p) => (p.id === id ? { ...p, ...changes } : p));
      save(data);
    },
    remove(airport, id) {
      const data = all();
      data[airport] = (data[airport] ?? []).filter((p) => p.id !== id);
      save(data);
    },
    selected(airport) {
      const list = this.list(airport);
      const id = store.get(SEL, {})[airport];
      return list.find((p) => p.id === id) ?? list[0] ?? null;
    },
    select(airport, id) {
      store.set(SEL, { ...store.get(SEL, {}), [airport]: id });
    },
  };
}
