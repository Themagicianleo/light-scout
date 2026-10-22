// config.js
// Every number the planner uses to make a judgement lives here, so you can tune it in one place.
// Calculated things (sun position, distances, wind components) don't need settings; estimates do.

export const CONFIG = {
  defaultAirport: 'WSSS', // Singapore Changi (checked against OurAirports, see README)

  // METAR and live traffic go through the SkyWatch Cloudflare relay: those providers don't allow
  // web pages on other sites to read their answers (CORS). It only answers themagicianleo.github.io.
  relayBase: 'https://spotters-relay.maotianze.workers.dev/?url=',

  // ---- Light quality (an ESTIMATE built on calculated sun and geometry) ----
  light: {
    goodAngleDeg: 60, // sun within this many degrees of "directly behind you" = front-lit
    sideAngleDeg: 90, // up to here the side facing you is still lit, but more from the side
    sideFactor: 0.4, // score multiplier at sideAngleDeg (fades from 1 at goodAngleDeg)
    backlitFactor: 0.1, // sun on the far side of the plane: the side you see is in shadow
    lowAltDeg: 5, // below this the sun is very low: warm but often hazy or blocked
    highAltDeg: 40, // above this light gets harsher
    veryHighAltDeg: 60, // above this the sun lights the top of the plane, not the side
    lowAltFactor: 0.5,
    highAltFactor: 0.6,
    veryHighAltFactor: 0.35,
    cloudWeight: 0.8, // fully cloudy sky removes this much of the score
    highCloudWeight: 0.5, // thin high cloud blocks less than low or mid cloud
    goodScore: 70, // score >= this: "good"
    fairScore: 40, // score >= this: "fair"; below: "poor"
    underPathOffsetM: 600, // beyond a runway end and this close to the centre line: under the flight path
  },

  // ---- Runway in use (an ESTIMATE from the METAR wind) ----
  wind: {
    calmKt: 3, // below this the wind doesn't decide the runway
    tooCloseKt: 2, // if the best end gets less headwind than this (mostly crosswind), say "too close to call"
  },

  metar: {
    refreshMinutes: 10, // METARs are issued every 30-60 minutes
    staleMinutes: 90, // older than this: show it, but say it's old
  },

  // ---- Live traffic ----
  traffic: {
    provider: 'adsbLol', // or 'airplanesLive' (see planner/sources/)
    pollSeconds: 20, // adsb.lol's headers say 60 requests/minute and 500/day; 20 s is gentle
    pauseAfterMinutes: 10, // stop polling after this long unless you press "keep live"
    radiusNm: 25, // area asked for around the airport
    maxAltitudeFt: 10000, // higher than this isn't arriving or departing nearby
    alignDeg: 30, // aircraft track within this of the runway direction counts as lined up
    maxOffsetNm: 2, // and within this distance of the extended centre line
    arriveRangeNm: 15, // arrivals are listed up to this far from the threshold
    departRangeNm: 10, // departures are listed up to this far from the runway end
    minSpeedKt: 50, // slower than this: on the ground or hovering; no time estimate
  },
};
