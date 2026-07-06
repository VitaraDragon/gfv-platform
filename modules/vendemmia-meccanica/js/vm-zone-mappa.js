/**
 * Controller mappa zone escluse vendemmia meccanica
 * Pattern tracciamento allineato a trattamenti/potatura (snap confini, marker, chiusura).
 * @module modules/vendemmia-meccanica/js/vm-zone-mappa
 */

import { loadVmGoogleMaps } from './vm-maps-loader.js';
import {
  normalizeLatLngCoord,
  serializePolygonPath,
  sumExcludedAreaHectares
} from '../services/zone-escluse-service.js';

const DEFAULT_CENTER = { lat: 44.4949, lng: 11.3426 };
const SNAP_DISTANCE_METERS = 5;
const VERTEX_SNAP_DISTANCE_METERS = 8;
const CLOSE_FIRST_POINT_METERS = 20;

const EXCLUDED_STYLE = {
  fillColor: '#E53935',
  fillOpacity: 0.45,
  strokeColor: '#B71C1C',
  strokeWeight: 3,
  editable: true,
  draggable: false,
  clickable: true
};
const HARVESTED_STYLE = {
  fillColor: '#43A047',
  fillOpacity: 0.4,
  strokeColor: '#2E7D32',
  strokeWeight: 2,
  editable: false,
  draggable: false,
  clickable: false
};
const BOUNDARY_STYLE = {
  fillColor: '#43A047',
  fillOpacity: 0.12,
  strokeColor: '#2E7D32',
  strokeWeight: 2,
  editable: false,
  draggable: false,
  clickable: false
};
const DRAWING_STYLE = {
  fillColor: '#FF9800',
  fillOpacity: 0.35,
  strokeColor: '#EF6C00',
  strokeWeight: 3,
  editable: true,
  draggable: false,
  clickable: false
};

function findNearestVertex(point, boundaryCoords, maxDistance) {
  let nearest = null;
  let minDistance = maxDistance;
  boundaryCoords.forEach((vertex) => {
    const distance = google.maps.geometry.spherical.computeDistanceBetween(point, vertex);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = vertex;
    }
  });
  return nearest;
}

function getClosestPointOnSegment(point, segmentStart, segmentEnd) {
  const A = point.lat();
  const B = point.lng();
  const C = segmentStart.lat();
  const D = segmentStart.lng();
  const E = segmentEnd.lat();
  const F = segmentEnd.lng();
  const dx = E - C;
  const dy = F - D;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return segmentStart;
  const t = Math.max(0, Math.min(1, ((A - C) * dx + (B - D) * dy) / lengthSquared));
  return new google.maps.LatLng(C + t * dx, D + t * dy);
}

function findNearestPointOnBoundary(point, boundaryCoords, maxDistance) {
  let nearest = null;
  let minDistance = maxDistance;
  for (let i = 0; i < boundaryCoords.length; i++) {
    const start = boundaryCoords[i];
    const end = boundaryCoords[(i + 1) % boundaryCoords.length];
    const closest = getClosestPointOnSegment(point, start, end);
    const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closest);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = closest;
    }
  }
  return nearest;
}

function getDistanceToBoundary(point, boundaryCoords) {
  let minDistance = Infinity;
  for (let i = 0; i < boundaryCoords.length; i++) {
    const start = boundaryCoords[i];
    const end = boundaryCoords[(i + 1) % boundaryCoords.length];
    const closest = getClosestPointOnSegment(point, start, end);
    const distance = google.maps.geometry.spherical.computeDistanceBetween(point, closest);
    minDistance = Math.min(minDistance, distance);
  }
  return minDistance;
}

function getPolygonCenter(coords) {
  let sumLat = 0;
  let sumLng = 0;
  coords.forEach((coord) => {
    sumLat += coord.lat();
    sumLng += coord.lng();
  });
  return new google.maps.LatLng(sumLat / coords.length, sumLng / coords.length);
}

function movePointInsideBoundary(point, boundaryCoords) {
  const nearestBoundaryPoint = findNearestPointOnBoundary(point, boundaryCoords, 100);
  if (!nearestBoundaryPoint) return point;
  const center = getPolygonCenter(boundaryCoords);
  const dx = center.lat() - nearestBoundaryPoint.lat();
  const dy = center.lng() - nearestBoundaryPoint.lng();
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return point;
  const moveDistance = 1 / 111000;
  return new google.maps.LatLng(
    nearestBoundaryPoint.lat() + (dx / length) * moveDistance,
    nearestBoundaryPoint.lng() + (dy / length) * moveDistance
  );
}

function snapPoint(rawPoint, boundaryCoords, disableSnap) {
  let snappedPoint = rawPoint;
  let snapApplied = false;
  if (disableSnap || !boundaryCoords.length) {
    return { snappedPoint, snapApplied };
  }

  const vertexSnap = findNearestVertex(snappedPoint, boundaryCoords, VERTEX_SNAP_DISTANCE_METERS);
  if (vertexSnap) {
    const snapDistance = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, vertexSnap);
    if (snapDistance <= VERTEX_SNAP_DISTANCE_METERS) {
      snappedPoint = vertexSnap;
      snapApplied = true;
    }
  }
  if (!snapApplied) {
    const boundarySnap = findNearestPointOnBoundary(snappedPoint, boundaryCoords, SNAP_DISTANCE_METERS);
    if (boundarySnap) {
      const snapDistance = google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, boundarySnap);
      if (snapDistance <= SNAP_DISTANCE_METERS) {
        snappedPoint = boundarySnap;
        snapApplied = true;
      }
    }
  }
  return { snappedPoint, snapApplied };
}

/**
 * @param {HTMLElement} containerEl
 * @param {{ onChange?: Function, onDrawingChange?: Function }} [options]
 */
export function createVmZoneMappa(containerEl, options = {}) {
  return new VmZoneMappaController(containerEl, options);
}

class VmZoneMappaController {
  constructor(containerEl, options = {}) {
    this.containerEl = containerEl;
    this.options = options;
    this.map = null;
    this.mapInnerEl = null;
    this.boundaryPolygon = null;
    this.boundaryCoords = [];
    this.excludedPolygons = [];
    this.harvestedPolygons = [];
    this.drawingCoords = [];
    this.drawingPolygon = null;
    this.drawingMarkers = [];
    this.firstPoint = null;
    this.isDrawing = false;
    this.clickListener = null;
    this.clickTimeout = null;
    this.mapReady = false;
  }

  async mount() {
    this.containerEl.innerHTML =
      '<div class="vm-zone-map-inner" id="vm-zone-map-inner" style="width:100%;height:100%;min-height:320px;"></div>';
    this.mapInnerEl = this.containerEl.querySelector('#vm-zone-map-inner');

    const ok = await loadVmGoogleMaps();
    if (!ok || typeof google === 'undefined' || !google.maps || !google.maps.geometry) {
      this.mapInnerEl.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;color:#666;background:#f8f9fa;border-radius:8px;">' +
        '<div><strong>Google Maps non disponibile</strong><br>Configura <code>core/config/google-maps-config.js</code> oppure usa l\'override manuale degli ettari.</div></div>';
      return false;
    }

    this.map = new google.maps.Map(this.mapInnerEl, {
      zoom: 15,
      center: DEFAULT_CENTER,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    });
    this.mapReady = true;
    return true;
  }

  resize() {
    if (!this.mapReady || !this.map) return;
    google.maps.event.trigger(this.map, 'resize');
    if (this.boundaryCoords.length) {
      this._fitBounds(this.boundaryCoords);
    }
  }

  destroy() {
    this.stopDrawing(true);
    this.clearAllZones();
    this.clearHarvestedZones();
    if (this.boundaryPolygon) {
      this.boundaryPolygon.setMap(null);
      this.boundaryPolygon = null;
    }
    this.boundaryCoords = [];
    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
      this.map = null;
    }
    this.mapReady = false;
    if (this.containerEl) this.containerEl.innerHTML = '';
  }

  setBoundary(polygonCoords) {
    if (!this.mapReady) return;
    if (this.boundaryPolygon) {
      this.boundaryPolygon.setMap(null);
      this.boundaryPolygon = null;
    }
    this.boundaryCoords = (polygonCoords || [])
      .map(normalizeLatLngCoord)
      .filter(Boolean)
      .map((c) => new google.maps.LatLng(c.lat, c.lng));
    if (this.boundaryCoords.length < 3) return;

    this.boundaryPolygon = new google.maps.Polygon({
      ...BOUNDARY_STYLE,
      paths: this.boundaryCoords,
      map: this.map
    });
    this._fitBounds(this.boundaryCoords);
  }

  loadExcludedZones(zoneEscluse) {
    if (!this.mapReady) return;
    this.stopDrawing(true);
    this.excludedPolygons.forEach((p) => p.setMap(null));
    this.excludedPolygons = [];

    (zoneEscluse || []).forEach((zone) => {
      const raw = zone?.coordinates || zone?.coords || [];
      const coords = raw.map(normalizeLatLngCoord).filter(Boolean);
      if (coords.length < 3) return;
      const path = coords.map((c) => new google.maps.LatLng(c.lat, c.lng));
      const poly = new google.maps.Polygon({
        ...EXCLUDED_STYLE,
        paths: path,
        map: this.map
      });
      this._bindPolygonChange(poly);
      this.excludedPolygons.push(poly);
    });

    if (!this.boundaryCoords.length && this.excludedPolygons.length) {
      const all = [];
      this.excludedPolygons.forEach((p) => all.push(...p.getPath().getArray()));
      if (all.length) this._fitBounds(all);
    }

    this._notifyChange();
  }

  /** Zone vendemmiate da lavoro (sola lettura, verdi). */
  loadHarvestedZones(zoneVendemmiate) {
    if (!this.mapReady) return;
    this.clearHarvestedZones();

    (zoneVendemmiate || []).forEach((zone) => {
      const raw = zone?.coordinates || zone?.coords || [];
      const coords = raw.map(normalizeLatLngCoord).filter(Boolean);
      if (coords.length < 3) return;
      const path = coords.map((c) => new google.maps.LatLng(c.lat, c.lng));
      const poly = new google.maps.Polygon({
        ...HARVESTED_STYLE,
        paths: path,
        map: this.map
      });
      this.harvestedPolygons.push(poly);
    });

    if (this.harvestedPolygons.length && !this.boundaryCoords.length) {
      const all = [];
      this.harvestedPolygons.forEach((p) => all.push(...p.getPath().getArray()));
      if (all.length) this._fitBounds(all);
    }
  }

  clearHarvestedZones() {
    this.harvestedPolygons.forEach((p) => p.setMap(null));
    this.harvestedPolygons = [];
  }

  toggleDrawing() {
    if (!this.mapReady) return false;
    if (this.isDrawing) {
      this.stopDrawing(false);
      return false;
    }
    this.startNewZone();
    return true;
  }

  startNewZone() {
    if (!this.mapReady) return;
    this._clearDrawingVisuals();
    this.drawingCoords = [];
    this.firstPoint = null;
    this.isDrawing = true;
    this._setDrawingMode(true);
    this._attachClickListener();
    this._notifyDrawingChange();
  }

  finishDrawingIfReady() {
    return this.drawingCoords.length >= 3 ? this.finishCurrentZone() : false;
  }

  finishCurrentZone() {
    if (!this.drawingCoords.length && this.drawingPolygon) {
      this.drawingCoords = this.drawingPolygon.getPath().getArray();
    }
    if (this.drawingCoords.length < 3) return false;

    const path = this.drawingCoords.slice();
    const poly = new google.maps.Polygon({
      ...EXCLUDED_STYLE,
      paths: path,
      map: this.map
    });
    this._bindPolygonChange(poly);
    this.excludedPolygons.push(poly);

    this._clearDrawingVisuals();
    this.drawingCoords = [];
    this.firstPoint = null;
    this.isDrawing = false;
    this._setDrawingMode(false);
    this._detachClickListener();
    this._notifyChange();
    this._notifyDrawingChange();
    return true;
  }

  stopDrawing(clearIncomplete = true) {
    this._detachClickListener();
    this.isDrawing = false;
    this._setDrawingMode(false);
    if (clearIncomplete) {
      this._clearDrawingVisuals();
      this.drawingCoords = [];
      this.firstPoint = null;
      this._notifyDrawingChange();
    }
  }

  removeLastZone() {
    const poly = this.excludedPolygons.pop();
    if (poly) poly.setMap(null);
    this._notifyChange();
  }

  clearAllZones() {
    this.stopDrawing(true);
    this.excludedPolygons.forEach((p) => p.setMap(null));
    this.excludedPolygons = [];
    this._notifyChange();
  }

  getSerializedZones() {
    return this.excludedPolygons.map((poly) => ({
      coordinates: serializePolygonPath(poly.getPath().getArray())
    }));
  }

  getExcludedHectares() {
    return sumExcludedAreaHectares(this.getSerializedZones(), google.maps);
  }

  getDrawingStats() {
    const points = this.drawingCoords.length;
    if (points < 3 || !google.maps?.geometry?.spherical) {
      return { points, areaHa: null };
    }
    const areaMq = google.maps.geometry.spherical.computeArea(this.drawingCoords);
    return { points, areaHa: Math.round((areaMq / 10000) * 100) / 100 };
  }

  _attachClickListener() {
    this._detachClickListener();
    this.clickListener = this.map.addListener('click', (event) => this._handleMapClick(event));
  }

  _detachClickListener() {
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    }
    if (this.clickListener) {
      google.maps.event.removeListener(this.clickListener);
      this.clickListener = null;
    }
  }

  _handleMapClick(event) {
    if (!this.isDrawing) return;

    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
      if (this.drawingCoords.length >= 3) {
        this.finishCurrentZone();
        return;
      }
      return;
    }

    this.clickTimeout = setTimeout(() => {
      this.clickTimeout = null;
      this._addDrawingPoint(event);
    }, 300);
  }

  _addDrawingPoint(event) {
    const disableSnap = !!(event.domEvent && event.domEvent.shiftKey);
    let { snappedPoint, snapApplied } = snapPoint(event.latLng, this.boundaryCoords, disableSnap);

    if (snapApplied && this.map) {
      const snapMarker = new google.maps.Marker({
        position: snappedPoint,
        map: this.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#00ff00',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        zIndex: 2000
      });
      setTimeout(() => snapMarker.setMap(null), 1000);
    }

    if (this.boundaryPolygon && this.boundaryCoords.length >= 3) {
      const isInside = google.maps.geometry.poly.containsLocation(snappedPoint, this.boundaryPolygon);
      const distanceToBoundary = getDistanceToBoundary(snappedPoint, this.boundaryCoords);
      if (!isInside && distanceToBoundary > 3) {
        window.alert('Il punto deve essere dentro i confini del terreno!');
        return;
      }
      if (!isInside && distanceToBoundary <= 3) {
        snappedPoint = movePointInsideBoundary(snappedPoint, this.boundaryCoords);
      }
    }

    if (this.drawingCoords.length === 0) {
      this.firstPoint = snappedPoint;
    }

    if (
      this.firstPoint &&
      this.drawingCoords.length >= 3 &&
      google.maps.geometry.spherical.computeDistanceBetween(snappedPoint, this.firstPoint) < CLOSE_FIRST_POINT_METERS
    ) {
      this.drawingCoords.push(this.firstPoint);
      this._updateDrawingVisuals();
      this.finishCurrentZone();
      window.alert('Poligono chiuso! Puoi modificarlo trascinando i punti o tracciare un\'altra zona.');
      return;
    }

    this.drawingCoords.push(snappedPoint);
    this._updateDrawingVisuals();
    this._notifyDrawingChange();
  }

  _updateDrawingVisuals() {
    this.drawingMarkers.forEach((m) => m.setMap(null));
    this.drawingMarkers = this.drawingCoords.map((point, index) =>
      new google.maps.Marker({
        position: point,
        map: this.map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: index === 0 ? 7 : 6,
          fillColor: index === 0 ? '#EF6C00' : '#FF9800',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        },
        zIndex: 1500 + index,
        clickable: false
      })
    );

    if (this.drawingPolygon) {
      this.drawingPolygon.setMap(null);
      this.drawingPolygon = null;
    }

    if (this.drawingCoords.length >= 2) {
      this.drawingPolygon = new google.maps.Polygon({
        ...DRAWING_STYLE,
        paths: this.drawingCoords,
        map: this.map
      });
      const path = this.drawingPolygon.getPath();
      ['set_at', 'insert_at', 'remove_at'].forEach((evt) => {
        google.maps.event.addListener(path, evt, () => {
          this.drawingCoords = path.getArray();
          this._notifyDrawingChange();
        });
      });
    }
  }

  _clearDrawingVisuals() {
    this.drawingMarkers.forEach((m) => m.setMap(null));
    this.drawingMarkers = [];
    if (this.drawingPolygon) {
      this.drawingPolygon.setMap(null);
      this.drawingPolygon = null;
    }
  }

  _setDrawingMode(active) {
    if (!this.containerEl) return;
    this.containerEl.classList.toggle('drawing-mode', !!active);
    const inner = this.mapInnerEl || this.containerEl.querySelector('.vm-zone-map-inner');
    if (!inner) return;
    const cursor = active ? 'crosshair' : '';
    inner.style.cursor = cursor;
    if (active) {
      setTimeout(() => {
        inner.querySelectorAll('div').forEach((el) => { el.style.cursor = 'crosshair'; });
        inner.querySelectorAll('canvas').forEach((el) => { el.style.cursor = 'crosshair'; });
      }, 100);
    } else {
      inner.style.cursor = '';
      inner.querySelectorAll('div').forEach((el) => { el.style.cursor = ''; });
      inner.querySelectorAll('canvas').forEach((el) => { el.style.cursor = ''; });
    }
    if (typeof this.options.onDrawingModeChange === 'function') {
      this.options.onDrawingModeChange(active);
    }
  }

  _bindPolygonChange(poly) {
    const path = poly.getPath();
    ['set_at', 'insert_at', 'remove_at'].forEach((evt) => {
      google.maps.event.addListener(path, evt, () => this._notifyChange());
    });
  }

  _notifyDrawingChange() {
    if (typeof this.options.onDrawingChange === 'function') {
      this.options.onDrawingChange(this.getDrawingStats());
    }
  }

  _notifyChange() {
    if (typeof this.options.onChange === 'function') {
      this.options.onChange({
        zoneEscluse: this.getSerializedZones(),
        ettariEsclusi: this.getExcludedHectares()
      });
    }
  }

  _fitBounds(latLngArray) {
    if (!this.map || !latLngArray.length) return;
    const bounds = new google.maps.LatLngBounds();
    latLngArray.forEach((ll) => bounds.extend(ll));
    this.map.fitBounds(bounds);
  }
}

export default { createVmZoneMappa };
