export const shortenGameName = (gameName: string): string => {
  if (!gameName) return '';

  const abbreviations: Record<string, string> = {
    'Black Ops': 'BO',
    'Modern Warfare': 'MW',
    'Warzone': 'WZ',
    'Battle Royale': 'BR',
    'The Last of Us': 'TLOU',
    'Grand Theft Auto': 'GTA',
    'Counter-Strike': 'CS',
    'Rainbow Six': 'R6',
    'Fortnite Battle Royale': 'Fortnite BR',
    'Player Unknown\'s Battlegrounds': 'PUBG',
    'Player Unknown': 'PU',
    'Battlegrounds': 'BG',
    'League of Legends': 'LoL',
    'Defense of the Ancients': 'DOTA',
    'World of Warcraft': 'WoW',
    'World of': 'WoW',
  };

  let shortened = gameName;

  for (const [full, abbr] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    shortened = shortened.replace(regex, abbr);
  }

  return shortened;
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const truncateTitle = (title: string, maxLength: number = 17): string => {
  if (!title) return '';
  if (title.length <= maxLength) return title;
  return title.substring(0, maxLength) + '...';
};
