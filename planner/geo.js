// geo.js
// Geometry on a small flat map around the airport. All CALCULATED, no estimates.
//
// Why flat? Within ~20 km of a point the Earth's curve changes distances by less than 0.1%,
// so we can turn latitude/longitude into metres east (x) and north (y) and use school geometry.

const M_PER_DEG_LAT = 110574; // metres per degree of latitude (near the equator; varies < 1%)
const M_PER_DEG_LON_EQ = 111320; // metres per degree of longitude at the equator
export const M_PER_NM = 1852;
const RAD = Math.PI / 180;

// A projection centred on (lat0, lon0). toXY gives metres east/north of the centre.
export function makeProjection(lat0, lon0) {
  const kx = M_PER_DEG_LON_EQ * Math.cos(lat0 * RAD); // longitude degrees get shorter away from the equator
  return {
    toXY: (lat, lon) => ({ x: (lon - lon0) * kx, y: (lat - lat0) * M_PER_DEG_LAT }),
    toLatLon: ({ x, y }) => ({ lat: lat0 + y / M_PER_DEG_LAT, lon: lon0 + x / kx }),
  };
}

// Compass bearing (0 = north, 90 = east) of a movement dx east, dy north.
export const bearingOf = (dx, dy) => ((Math.atan2(dx, dy) / RAD) + 360) % 360;

// Signed difference a - b, folded into -180..180 (e.g. 350 - 10 = -20).
export const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;

// Great-circle distance in metres (haversine, on a sphere), for aircraft further away. A sphere
// overstates north-south distances near the equator by ~0.5%: fine for "about 12 nm out".
export function distanceM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dp = p2 - p1, dl = (lon2 - lon1) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

// Where is point P relative to a runway that runs from end A to end B?
//   along   t: metres from A towards B of the closest point on the centre line
//   offset  c: metres sideways from the centre line; + means LEFT of a plane flying A -> B
//   Q:          the closest point on the (extended) centre line, where passing planes come nearest
//   beyond:     'A' or 'B' if P is past that end (then planes pass over/near you on approach or climb-out)
// Diagram: A ----Q---------- B      u = direction A -> B (unit length)
//                 |  c                t = (P - A) . u      (dot product = how far along)
//                 P                   c = u x (P - A)      (cross product = how far sideways, with a sign)
export function runwayRelation(proj, runway, lat, lon) {
  const A = proj.toXY(runway.leLat, runway.leLon);
  const B = proj.toXY(runway.heLat, runway.heLon);
  const P = proj.toXY(lat, lon);
  const L = Math.hypot(B.x - A.x, B.y - A.y); // runway length in metres
  const u = { x: (B.x - A.x) / L, y: (B.y - A.y) / L }; // unit vector along the runway
  const ap = { x: P.x - A.x, y: P.y - A.y };
  const t = ap.x * u.x + ap.y * u.y; // dot product
  const c = u.x * ap.y - u.y * ap.x; // 2D cross product: + = to the left of u
  const Q = { x: A.x + t * u.x, y: A.y + t * u.y };
  const beyond = t < 0 ? 'A' : t > L ? 'B' : null;
  const endPt = (which) => (which === 'A' ? A : B);
  // Distance to the runway itself (the segment), not the infinite line.
  const clampT = Math.min(Math.max(t, 0), L);
  const S = { x: A.x + clampT * u.x, y: A.y + clampT * u.y };
  return {
    lengthM: L,
    alongM: t,
    offsetM: c,
    distToCentrelineM: Math.abs(c),
    distToRunwayM: Math.hypot(P.x - S.x, P.y - S.y),
    beyond,
    // Direction from the plane to you: this decides which side of the plane faces you.
    // Beside the runway the plane is at Q (straight across). Beyond an end you may be ON the
    // centre line, where Q is your own spot, so we use the runway end instead: you face the runway.
    planeToCameraDeg: beyond ? bearingOf(P.x - endPt(beyond).x, P.y - endPt(beyond).y) : bearingOf(P.x - Q.x, P.y - Q.y),
    // Direction you face to look at the runway (the centre line, or the runway end if beyond it).
    cameraToRunwayDeg: beyond ? bearingOf(endPt(beyond).x - P.x, endPt(beyond).y - P.y) : bearingOf(Q.x - P.x, Q.y - P.y),
    bearingAtoB: bearingOf(u.x, u.y), // true direction of travel for the A-end runway (e.g. 02 = ~023)
    Q: proj.toLatLon(Q),
  };
}

// Distance (m) of a point from the extended centre line of travel direction `headingDeg` through
// threshold T, and how far "before" (negative) or "after" (positive) the threshold it is.
export function relativeToThreshold(proj, T, headingDeg, lat, lon) {
  const t = proj.toXY(T.lat, T.lon), p = proj.toXY(lat, lon);
  const u = { x: Math.sin(headingDeg * RAD), y: Math.cos(headingDeg * RAD) };
  const d = { x: p.x - t.x, y: p.y - t.y };
  return { alongM: d.x * u.x + d.y * u.y, offsetM: u.x * d.y - u.y * d.x };
}
