// i18n.js
// Planner text in English and Simplified Chinese. Light Scout's EN / 中文 switch picks the language.

const STR = {
  en: {
    calc: 'Calculated', est: 'Estimate',
    safetyTitle: 'Spot responsibly',
    safety: 'This planner only uses positions you add yourself; it never suggests places to stand. Before you go, check local rules, airport security restrictions and private property boundaries. Never enter restricted areas, and follow instructions from police and airport staff.',
    airportTitle: 'Airport', airportPh: 'Search ICAO, IATA, name or city (e.g. WSSS, SIN, Changi)',
    airportMeta: '{icao}{iata} · {n} runways · elevation {elev} ft', noAirports: 'No airport found.', airportsErr: 'The airport list could not load. Check your connection and reload.',
    runway: 'Runway', mismatch: 'Heads up: for {rw}, the database heading ({h}°) and the end coordinates ({c}°) disagree by more than 5°. The planner uses the coordinates.',
    headingFromCoords: 'This runway has no heading in the database; directions come from its end coordinates.',
    positionsTitle: 'Your positions', addTap: 'Add by tapping the map', addTapOn: 'Tap the map where you will stand…', myLoc: 'My location', fromSaved: 'From saved places', coords: 'Coordinates',
    coordsPrompt: 'Latitude, longitude (e.g. 1.3570, 104.0005):', namePrompt: 'Name this position:', posName: 'Position {n}', rename: 'Rename', remove: 'Delete', removeConfirm: 'Delete "{name}"?',
    noPositions: 'No positions yet. Add one to see the light for it.', noSaved: 'No saved places in Light Scout yet (use the ☆ on the Light tab).', badCoords: 'Please enter latitude, longitude.', locErr: 'Your location is not available here.',
    mapNote: 'Map tiles need a connection. Runways from OurAirports.',
    geoTitle: 'Your position and the runway', distCentre: 'To the centre line', side: 'Side', sideText: 'Left of planes using {a}, right of planes using {b}',
    along: 'Along the runway', alongText: '{d} from the {end} end', beyond: 'Beyond the {end} end, {d} from it', underPath: 'You are under the approach/departure path: planes pass close to overhead, so you mostly see the belly and side light matters less.',
    face: 'Look towards', faceText: '{deg}° ({card}) to see the centre line', runwayLen: 'Runway length', lenText: '{m} m (database {ft} ft)',
    lightTitle: 'Light on aircraft, by hour', lightNote: 'Sun position and angles are calculated. The score is an estimate: front-lit (sun within {good}° of behind you) and sun {lo}–{hi}° high scores best; cloud lowers it.',
    dirTitle: 'Planes moving {ident} → {deg}°', view_front: 'nose towards you (front ¾)', view_side: 'passing side-on', view_tail: 'tail towards you',
    view_leftSide: 'you see the aircraft\'s left side; it moves right → left', view_rightSide: 'you see the aircraft\'s right side; it moves left → right',
    best: 'Best: {from}–{to}, {rating}, up to {score}', noBest: 'No good or fair light this day.', r_good: 'good', r_fair: 'fair', r_poor: 'poor', r_none: 'no sun',
    lighting_front: 'front-lit', lighting_side: 'side-lit', lighting_back: 'backlit',
    showNumbers: 'Show the numbers', hour: 'Hour', sunAz: 'Sun az', sunAlt: 'Sun alt', angle: 'Angle', cloud: 'Cloud L/M/H', score: 'Score',
    noCloud: 'No cloud forecast for this day: scores assume the sun is not blocked.', today: 'Today', tomorrow: 'Tomorrow', dayN: 'In {n} days',
    tzNote: 'Times are the airport\'s local time ({tz}).', tzDevice: 'Times are your device time until the forecast tells us the airport\'s time zone.',
    sameLight: 'Both directions get the same light (it depends on which side of the runway you stand); what changes is which side of the aircraft you see, or nose versus tail if you are beyond a runway end.',
    windTitle: 'Wind and runway in use', metarFrom: 'METAR {station}, observed {time} ({ago})', windUnavailable: 'Wind unavailable: no usable METAR for {station}. The runway in use is not estimated.',
    windLoading: 'Loading the latest METAR…', windOld: 'This report is {ago} old.', windSaved: 'Offline: showing the METAR saved {when}.',
    wind: 'Wind', windText: '{dir}° at {spd} kt', gust: ', gusting {g} kt', windVrb: 'variable at {spd} kt', windCalm: 'calm',
    likely: '{ident} likely in use', calm: 'Wind too light to pick a runway.', variable: 'Wind direction variable: no estimate.', close: 'Mostly crosswind: too close to call.',
    end: 'Runway end', heading: 'Heading', head: 'Headwind', cross: 'Crosswind', fromRight: 'from right', fromLeft: 'from left', tail: 'tailwind',
    windWhy: 'Planes take off and land into the wind, so the end with the most headwind is the likely one. Air traffic control decides; noise rules and traffic can override the wind.',
    windRelay: 'Fetched through the SkyWatch relay (aviationweather.gov does not allow web pages to read it directly).',
    trafficTitle: 'Live traffic', trafficNote: 'Aircraft lined up with a runway within {r} nm. Time to the runway = distance ÷ ground speed: an estimate.',
    arriving: 'Arriving {ident}', departing: 'Departing {ident}', eta: '~{m} min to the threshold', etaSoon: 'under a minute', atDist: '{d} nm · {alt} · {gs} kt',
    noTraffic: 'No aircraft are arriving or departing right now within {r} nm.', trafficErr: 'Live traffic could not load: {e}', trafficPaused: 'Paused to save the provider\'s rate limit.', keepLive: 'Resume live', updated: 'Updated {time}',
    ground: 'on the ground', others: '{n} other aircraft nearby (not lined up with a runway).',
    credits: 'Runways and airports: {oa} (public domain). Weather: METAR from {awc} (US public domain; not for flight planning); cloud forecast from {om}. Live traffic: {ads}. Map: {osm}. Sun position calculated on your device.',
  },
  zh: {
    calc: '计算值', est: '估计值',
    safetyTitle: '文明拍机',
    safety: '本规划器只使用你自己添加的位置，绝不推荐拍摄地点。出发前请查看当地规定、机场安保限制和私人物业边界。切勿进入禁区，并听从警察和机场工作人员的指示。',
    airportTitle: '机场', airportPh: '搜索 ICAO、IATA、名称或城市（如 WSSS、SIN、樟宜）',
    airportMeta: '{icao}{iata} · {n} 条跑道 · 标高 {elev} 英尺', noAirports: '未找到机场。', airportsErr: '机场列表无法加载。请检查网络后刷新。',
    runway: '跑道', mismatch: '注意：{rw} 在数据库中的航向（{h}°）与两端坐标（{c}°）相差超过 5°。规划器使用坐标。',
    headingFromCoords: '数据库中没有这条跑道的航向；方向由两端坐标计算。',
    positionsTitle: '你的位置', addTap: '在地图上点选添加', addTapOn: '在地图上点你要站的位置…', myLoc: '我的位置', fromSaved: '从收藏地点', coords: '坐标',
    coordsPrompt: '纬度, 经度（如 1.3570, 104.0005）：', namePrompt: '给这个位置命名：', posName: '位置 {n}', rename: '重命名', remove: '删除', removeConfirm: '删除“{name}”？',
    noPositions: '还没有位置。添加一个即可查看光线。', noSaved: 'Light Scout 中还没有收藏地点（在“光线”页点 ☆）。', badCoords: '请输入 纬度, 经度。', locErr: '此处无法获取你的位置。',
    mapNote: '地图需要联网。跑道数据来自 OurAirports。',
    geoTitle: '你的位置与跑道', distCentre: '到跑道中线', side: '方位', sideText: '在使用 {a} 的飞机左侧，使用 {b} 的飞机右侧',
    along: '沿跑道', alongText: '距 {end} 端 {d}', beyond: '在 {end} 端之外，距其 {d}', underPath: '你在进近/离场航线下方：飞机几乎从头顶经过，主要拍到机腹，侧光影响较小。',
    face: '朝向', faceText: '{deg}°（{card}）可看到跑道中线', runwayLen: '跑道长度', lenText: '{m} 米（数据库 {ft} 英尺）',
    lightTitle: '飞机受光情况（逐小时）', lightNote: '太阳位置和角度为计算值。评分是估计：顺光（太阳在你身后 {good}° 以内）且太阳高度 {lo}–{hi}° 得分最高；云会降低评分。',
    dirTitle: '飞机朝 {ident} → {deg}° 方向', view_front: '机头朝你（前侧 ¾）', view_side: '侧面经过', view_tail: '机尾朝你',
    view_leftSide: '你看到飞机左侧；它从右向左移动', view_rightSide: '你看到飞机右侧；它从左向右移动',
    best: '最佳：{from}–{to}，{rating}，最高 {score}', noBest: '当天没有好或一般的光线。', r_good: '好', r_fair: '一般', r_poor: '差', r_none: '无日照',
    lighting_front: '顺光', lighting_side: '侧光', lighting_back: '逆光',
    showNumbers: '显示数字', hour: '时间', sunAz: '太阳方位', sunAlt: '太阳高度', angle: '夹角', cloud: '云 低/中/高', score: '评分',
    noCloud: '当天没有云量预报：评分假设太阳未被遮挡。', today: '今天', tomorrow: '明天', dayN: '{n} 天后',
    tzNote: '时间为机场当地时间（{tz}）。', tzDevice: '在预报给出机场时区前，时间为你设备的时区。',
    sameLight: '两个方向的光线相同（取决于你站在跑道哪一侧）；不同的是你看到飞机的哪一侧，或在跑道端外时看到机头还是机尾。',
    windTitle: '风与使用中的跑道', metarFrom: 'METAR {station}，观测于 {time}（{ago}）', windUnavailable: '风数据不可用：{station} 没有可用的 METAR。不估计使用中的跑道。',
    windLoading: '正在加载最新 METAR…', windOld: '这份报告已是 {ago} 前的。', windSaved: '离线：显示 {when} 保存的 METAR。',
    wind: '风', windText: '{dir}°，{spd} 节', gust: '，阵风 {g} 节', windVrb: '风向不定，{spd} 节', windCalm: '静风',
    likely: '可能使用 {ident}', calm: '风太小，无法判断跑道。', variable: '风向不定：不作估计。', close: '以侧风为主：难以判断。',
    end: '跑道端', heading: '航向', head: '顶风', cross: '侧风', fromRight: '来自右侧', fromLeft: '来自左侧', tail: '顺风',
    windWhy: '飞机逆风起降，所以顶风最大的一端最可能被使用。由空管决定；噪音规定和交通流量可能不按风向。',
    windRelay: '通过 SkyWatch 中转获取（aviationweather.gov 不允许网页直接读取）。',
    trafficTitle: '实时航班', trafficNote: '{r} 海里内对准跑道的飞机。到达跑道时间 = 距离 ÷ 地速：仅为估计。',
    arriving: '进近 {ident}', departing: '离场 {ident}', eta: '约 {m} 分钟到跑道入口', etaSoon: '不到一分钟', atDist: '{d} 海里 · {alt} · {gs} 节',
    noTraffic: '{r} 海里内目前没有进近或离场的飞机。', trafficErr: '实时航班无法加载：{e}', trafficPaused: '已暂停，以免超出数据源的频率限制。', keepLive: '继续实时', updated: '更新于 {time}',
    ground: '在地面', others: '附近另有 {n} 架飞机（未对准跑道）。',
    credits: '跑道与机场：{oa}（公有领域）。天气：METAR 来自 {awc}（美国公有领域；不可用于飞行计划）；云量预报来自 {om}。实时航班：{ads}。地图：{osm}。太阳位置在你的设备上计算。',
  },
};

let langFn = () => 'en';
export const setLangSource = (fn) => { langFn = fn; };
export function t(key, vars) {
  let s = STR[langFn()]?.[key] ?? STR.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
  return s;
}
const CARD = {
  en: ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'],
  zh: ['北', '东北偏北', '东北', '东北偏东', '东', '东南偏东', '东南', '东南偏南', '南', '西南偏南', '西南', '西南偏西', '西', '西北偏西', '西北', '西北偏北'],
};
export const cardinal = (deg) => (CARD[langFn()] ?? CARD.en)[Math.round(deg / 22.5) % 16];
