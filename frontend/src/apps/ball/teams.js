// Team definitions: flag, colors, and physics stats
// speed    → base autonomous velocity (px/frame at 60fps)
// mass     → affects collision physics (heavier = pushes more)
// friction → velocity damping per frame (< 1 = drag)
// agility  → how fast it can change direction (steering factor)

export const TEAMS = [
  {
    id: 'brazil',
    name: 'Brazil',
    flag: '🇧🇷',
    color: '#FFD700',
    secondary: '#009C3B',
    textColor: '#005A22',
    speed: 3.4, mass: 1.0, friction: 0.988, agility: 0.18,
  },
  {
    id: 'argentina',
    name: 'Argentina',
    flag: '🇦🇷',
    color: '#74ACDF',
    secondary: '#FAFAFA',
    textColor: '#003F7F',
    speed: 3.2, mass: 1.05, friction: 0.985, agility: 0.16,
  },
  {
    id: 'germany',
    name: 'Germany',
    flag: '🇩🇪',
    color: '#1A1A1A',
    secondary: '#DD0000',
    textColor: '#FFFFFF',
    speed: 2.9, mass: 1.3, friction: 0.982, agility: 0.13,
  },
  {
    id: 'france',
    name: 'France',
    flag: '🇫🇷',
    color: '#002395',
    secondary: '#ED2939',
    textColor: '#FFFFFF',
    speed: 3.3, mass: 1.0, friction: 0.986, agility: 0.17,
  },
  {
    id: 'england',
    name: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    color: '#CF142B',
    secondary: '#FFFFFF',
    textColor: '#FFFFFF',
    speed: 3.0, mass: 1.1, friction: 0.984, agility: 0.15,
  },
  {
    id: 'spain',
    name: 'Spain',
    flag: '🇪🇸',
    color: '#AA151B',
    secondary: '#F1BF00',
    textColor: '#FFFFFF',
    speed: 3.1, mass: 1.0, friction: 0.987, agility: 0.19,
  },
  {
    id: 'italy',
    name: 'Italy',
    flag: '🇮🇹',
    color: '#009246',
    secondary: '#CE2B37',
    textColor: '#FFFFFF',
    speed: 3.0, mass: 1.1, friction: 0.983, agility: 0.16,
  },
  {
    id: 'portugal',
    name: 'Portugal',
    flag: '🇵🇹',
    color: '#006600',
    secondary: '#FF0000',
    textColor: '#FFFFFF',
    speed: 3.2, mass: 1.0, friction: 0.986, agility: 0.17,
  },
  {
    id: 'netherlands',
    name: 'Netherlands',
    flag: '🇳🇱',
    color: '#FF6600',
    secondary: '#FFFFFF',
    textColor: '#993D00',
    speed: 3.1, mass: 1.0, friction: 0.985, agility: 0.18,
  },
  {
    id: 'mexico',
    name: 'Mexico',
    flag: '🇲🇽',
    color: '#006847',
    secondary: '#CE1126',
    textColor: '#FFFFFF',
    speed: 3.2, mass: 1.0, friction: 0.986, agility: 0.18,
  },
  {
    id: 'belgium',
    name: 'Belgium',
    flag: '🇧🇪',
    color: '#EF3340',
    secondary: '#000000',
    textColor: '#FFFFFF',
    speed: 3.1, mass: 1.05, friction: 0.985, agility: 0.16,
  },
  {
    id: 'croatia',
    name: 'Croatia',
    flag: '🇭🇷',
    color: '#FF0000',
    secondary: '#FFFFFF',
    textColor: '#FFFFFF',
    speed: 3.0, mass: 1.05, friction: 0.984, agility: 0.17,
  },
  {
    id: 'uruguay',
    name: 'Uruguay',
    flag: '🇺🇾',
    color: '#5EB6E4',
    secondary: '#FFFFFF',
    textColor: '#003DA5',
    speed: 3.0, mass: 1.1, friction: 0.983, agility: 0.15,
  },
  {
    id: 'morocco',
    name: 'Morocco',
    flag: '🇲🇦',
    color: '#C1272D',
    secondary: '#006233',
    textColor: '#FFFFFF',
    speed: 3.3, mass: 0.95, friction: 0.987, agility: 0.20,
  },
  {
    id: 'japan',
    name: 'Japan',
    flag: '🇯🇵',
    color: '#BC002D',
    secondary: '#FFFFFF',
    textColor: '#FFFFFF',
    speed: 3.5, mass: 0.9, friction: 0.990, agility: 0.22,
  },
];

export function getTeam(id) {
  return TEAMS.find((t) => t.id === id) ?? TEAMS[0];
}

// Returns a color guaranteed to be readable on a dark (#111) background.
// If team.color is too dark (e.g. Germany black), falls back to team.secondary.
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
