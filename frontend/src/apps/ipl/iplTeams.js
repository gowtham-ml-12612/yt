// IPL Team definitions: logo, colors, and physics stats
// speed    → base autonomous velocity (px/frame at 60fps)
// mass     → affects collision physics (heavier = pushes more)
// friction → velocity damping per frame (< 1 = drag)
// agility  → how fast it can change direction (steering factor)

export const TEAMS = [
  {
    id: 'mi',
    name: 'Mumbai Indians',
    flag: 'MI',
    imageSrc: '/ipl/mi.webp',
    color: '#004BA0',
    secondary: '#D1AB3E',
    textColor: '#FFFFFF',
    speed: 3.4, mass: 1.1, friction: 0.986, agility: 0.17,
  },
  {
    id: 'csk',
    name: 'Chennai Super Kings',
    flag: 'CSK',
    imageSrc: '/ipl/csk.webp',
    color: '#FDB913',
    secondary: '#0E509E',
    textColor: '#001A57',
    speed: 3.3, mass: 1.0, friction: 0.985, agility: 0.18,
  },
  {
    id: 'rcb',
    name: 'Royal Challengers',
    flag: 'RCB',
    imageSrc: '/ipl/rcb.webp',
    color: '#EC1C24',
    secondary: '#1A1A1A',
    textColor: '#FFFFFF',
    speed: 3.5, mass: 0.95, friction: 0.990, agility: 0.21,
  },
  {
    id: 'kkr',
    name: 'Kolkata Knight Riders',
    flag: 'KKR',
    imageSrc: '/ipl/kkr.webp',
    color: '#3A225D',
    secondary: '#B3A123',
    textColor: '#FFFFFF',
    speed: 3.1, mass: 1.1, friction: 0.984, agility: 0.16,
  },
  {
    id: 'dc',
    name: 'Delhi Capitals',
    flag: 'DC',
    imageSrc: '/ipl/dc.webp',
    color: '#004C93',
    secondary: '#EF1B23',
    textColor: '#FFFFFF',
    speed: 3.2, mass: 1.0, friction: 0.985, agility: 0.18,
  },
  {
    id: 'pbks',
    name: 'Punjab Kings',
    flag: 'PBKS',
    imageSrc: '/ipl/pbks.webp',
    color: '#ED1B24',
    secondary: '#DCB35C',
    textColor: '#FFFFFF',
    speed: 3.3, mass: 1.0, friction: 0.986, agility: 0.19,
  },
  {
    id: 'rr',
    name: 'Rajasthan Royals',
    flag: 'RR',
    imageSrc: '/ipl/rr.webp',
    color: '#254AA5',
    secondary: '#FF69B4',
    textColor: '#FFFFFF',
    speed: 3.2, mass: 1.05, friction: 0.985, agility: 0.17,
  },
  {
    id: 'srh',
    name: 'Sunrisers Hyderabad',
    flag: 'SRH',
    imageSrc: '/ipl/srh.webp',
    color: '#F7A721',
    secondary: '#1A1A1A',
    textColor: '#000000',
    speed: 3.4, mass: 0.98, friction: 0.987, agility: 0.20,
  },
  {
    id: 'gt',
    name: 'Gujarat Titans',
    flag: 'GT',
    imageSrc: '/ipl/gt.webp',
    color: '#1B2133',
    secondary: '#C8A84B',
    textColor: '#FFFFFF',
    speed: 3.0, mass: 1.15, friction: 0.983, agility: 0.15,
  },
  {
    id: 'lsg',
    name: 'Lucknow Super Giants',
    flag: 'LSG',
    imageSrc: '/ipl/lsg.webp',
    color: '#A72056',
    secondary: '#56CCF2',
    textColor: '#FFFFFF',
    speed: 3.2, mass: 1.02, friction: 0.986, agility: 0.17,
  },
];

export function getTeam(id) {
  return TEAMS.find((t) => t.id === id) ?? TEAMS[0];
}

// Returns a color guaranteed to be readable on a dark (#111) background.
function _luminance(hex) {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(c.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  } catch { return 1; }
}

export function uiColor(team) {
  return _luminance(team.color) < 0.06 ? team.secondary : team.color;
}
