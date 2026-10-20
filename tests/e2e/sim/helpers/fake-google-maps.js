/**
 * Google Maps finto per l'E2E delle zone.
 * Si installa con page.addInitScript prima del caricamento della pagina.
 * I poligoni finiscono in window.__gfvFakeMaps.
 */
(function (root) {
  var polygons = [];
  var polylines = [];
  root.__gfvFakeMaps = { polygons: polygons, polylines: polylines, maps: [] };

  function num(value, owner) {
    if (typeof value === 'function') return Number(value.call(owner));
    return Number(value);
  }

  function plainPoint(point) {
    if (!point) return null;
    return { lat: num(point.lat, point), lng: num(point.lng, point) };
  }

  function LatLng(lat, lng) {
    this._lat = num(lat);
    this._lng = num(lng);
  }
  LatLng.prototype.lat = function () { return this._lat; };
  LatLng.prototype.lng = function () { return this._lng; };

  function LatLngBounds() {
    this.points = [];
  }
  LatLngBounds.prototype.extend = function (point) {
    this.points.push(plainPoint(point));
  };

  function MVCArray(items) {
    this.items = (items || []).slice();
    this.listeners = {};
  }
  MVCArray.prototype.getArray = function () { return this.items.slice(); };
  MVCArray.prototype.push = function (item) {
    this.items.push(item);
    return this.items.length;
  };
  MVCArray.prototype.addListener = function () { return { remove: function () {} }; };

  function Overlay(kind, opts) {
    this.kind = kind;
    this.opts = opts || {};
    var raw = this.opts.paths || this.opts.path || [];
    this.points = Array.isArray(raw) ? raw.map(plainPoint) : [];
    this.map = null;
    if (kind === 'polygon') polygons.push(this);
    if (kind === 'polyline') polylines.push(this);
  }
  Overlay.prototype.setMap = function (map) { this.map = map; };
  Overlay.prototype.getPath = function () { return new MVCArray(this.points.map(function (p) { return new LatLng(p.lat, p.lng); })); };
  Overlay.prototype.addListener = function () { return { remove: function () {} }; };

  function Map(el, opts) {
    this.el = el;
    this.opts = opts || {};
    this.listeners = {};
    root.__gfvFakeMaps.maps.push(this);
  }
  Map.prototype.addListener = function (name, fn) {
    this.listeners[name] = fn;
    return { remove: function () {} };
  };
  Map.prototype.setCenter = function () {};
  Map.prototype.setZoom = function () {};
  Map.prototype.fitBounds = function () {};
  Map.prototype.panTo = function () {};

  function Marker(opts) {
    this.opts = opts || {};
    this.map = opts && opts.map;
  }
  Marker.prototype.setMap = function (map) { this.map = map; };

  function toRad(deg) { return deg * Math.PI / 180; }
  function distance(a, b) {
    var R = 6378137;
    var p1 = plainPoint(a);
    var p2 = plainPoint(b);
    var dLat = toRad(p2.lat - p1.lat);
    var dLng = toRad(p2.lng - p1.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
      + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  root.google = {
    maps: {
      Map: Map,
      LatLng: LatLng,
      LatLngBounds: LatLngBounds,
      Polygon: function (opts) { return new Overlay('polygon', opts); },
      Polyline: function (opts) { return new Overlay('polyline', opts); },
      Marker: Marker,
      MapTypeId: { SATELLITE: 'satellite', ROADMAP: 'roadmap' },
      SymbolPath: { CIRCLE: 0 },
      Geocoder: function () {
        this.geocode = function (_req, cb) { if (cb) cb([], 'ZERO_RESULTS'); };
      },
      event: {
        addListener: function (target, name, fn) {
          if (target && typeof target.addListener === 'function') return target.addListener(name, fn);
          return { remove: function () {} };
        }
      },
      geometry: {
        spherical: {
          computeDistanceBetween: distance,
          computeArea: function () { return 0; },
          computeLength: function () { return 0; }
        },
        poly: {
          containsLocation: function () { return true; }
        }
      }
    }
  };

  if (!root.GOOGLE_MAPS_API_KEY) root.GOOGLE_MAPS_API_KEY = 'gfv-fake-maps';
})(typeof window !== 'undefined' ? window : globalThis);
