// Minimal stand-in for Leaflet in jsdom (no canvas, no layout).
type Handler = () => void;

export class FakeMap {
  center = { lat: 0, lng: 0 };
  zoom = 0;
  handlers: Record<string, Handler[]> = {};
  attributionControl = { setPrefix: () => this.attributionControl };
  removed = false;

  setView([lat, lng]: [number, number], zoom: number) {
    const first = this.zoom === 0 && this.center.lat === 0 && this.center.lng === 0;
    this.center = { lat, lng };
    this.zoom = zoom;
    if (!first) this.move();
    return this;
  }
  /** Simulate the user dragging the map. */
  panTo(lat: number, lng: number) {
    this.center = { lat, lng };
    this.move();
  }
  move() {
    this.fire('movestart');
    this.fire('moveend');
  }
  fire(evt: string) {
    for (const h of this.handlers[evt] ?? []) h();
  }
  on(evt: string, h: Handler) {
    (this.handlers[evt] ??= []).push(h);
    return this;
  }
  getCenter() {
    const c = this.center;
    return { wrap: () => c };
  }
  zoomIn() {
    this.zoom++;
  }
  zoomOut() {
    this.zoom--;
  }
  remove() {
    this.removed = true;
  }
}

export const maps: FakeMap[] = [];

const L = {
  map: () => {
    const m = new FakeMap();
    maps.push(m);
    return m;
  },
  tileLayer: () => ({ addTo: () => undefined }),
};

export default L;
