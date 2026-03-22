import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Keyboard,
  Platform,
  RefreshControl,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, X, Play, User, Film, Camera, Video, Gamepad2 } from 'lucide-react-native';
import { Clip, Screenshot } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, TwitchGame } from '@/lib/api';

import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import LevelDetailsModal from '@/components/LevelDetailsModal';

interface Game {
  id: string;
  name: string;
  boxArt: string;
}

interface SearchUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level?: number;
}

const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;

const GAME_CATEGORIES: Record<string, string> = {
  'League of Legends': 'MOBA',
  'Dota 2': 'MOBA',
  'Teamfight Tactics': 'Strategy',
  'Legends of Runeterra': 'Card Game',
  'Grand Theft Auto V': 'Open World',
  'Counter-Strike 2': 'FPS',
  'VALORANT': 'FPS',
  'Call of Duty: Warzone': 'Battle Royale',
  'Call of Duty: Modern Warfare III': 'FPS',
  'Call of Duty: Black Ops III': 'FPS',
  'Fortnite': 'Battle Royale',
  'PUBG: BATTLEGROUNDS': 'Battle Royale',
  'Apex Legends': 'Battle Royale',
  'Minecraft': 'Sandbox',
  'Rust': 'Survival',
  'Elden Ring': 'RPG',
  'Dark Souls III': 'Action RPG',
  'Dark Souls': 'Action RPG',
  'Hollow Knight': 'Indie',
  'Celeste': 'Indie',
  'Hades': 'Roguelike',
  'The Binding of Isaac: Rebirth': 'Roguelike',
  'Rocket League': 'Sports',
  'Tom Clancy\'s Rainbow Six Siege': 'FPS',
  'Overwatch 2': 'FPS',
  'World of Warcraft': 'MMORPG',
  'Final Fantasy XIV Online': 'MMORPG',
  'Lost Ark': 'MMORPG',
  'Black Desert Online': 'MMORPG',
  'Old School RuneScape': 'MMORPG',
  'RuneScape': 'MMORPG',
  'Dead by Daylight': 'Horror',
  'Phasmophobia': 'Horror',
  'Resident Evil Village': 'Horror',
  'DayZ': 'Survival',
  'Valheim': 'Survival',
  'Hearthstone': 'Card Game',
  'Magic: The Gathering': 'Card Game',
  'Baldur\'s Gate 3': 'RPG',
  'The Witcher 3: Wild Hunt': 'RPG',
  'Diablo IV': 'Action RPG',
  'Path of Exile': 'Action RPG',
  'Warframe': 'Action RPG',
  'Sea of Thieves': 'Adventure',
  'Hogwarts Legacy': 'RPG',
  'Honkai: Star Rail': 'RPG',
  'Genshin Impact': 'RPG',
  'Palworld': 'Survival',
  'Stardew Valley': 'Simulation',
  'The Sims 4': 'Simulation',
  'Cities: Skylines': 'Simulation',
  'Satisfactory': 'Simulation',
  'Factorio': 'Strategy',
  'Age of Empires II': 'Strategy',
  'Age of Empires IV': 'Strategy',
  'Civilization VI': 'Strategy',
  'Crusader Kings III': 'Strategy',
  'XCOM 2': 'Strategy',
  'StarCraft II': 'Strategy',
  'Total War: Warhammer III': 'Strategy',
  'Super Smash Bros. Ultimate': 'Fighting',
  'Super Smash Bros. Melee': 'Fighting',
  'MultiVersus': 'Fighting',
  'Terraria': 'Sandbox',
  'Roblox': 'Sandbox',
  'Escape From Tarkov': 'FPS',
  'Destiny 2': 'FPS',
  'Battlefield 1': 'FPS',
  'Battlefield 2042': 'FPS',
  'Pokémon Sword/Shield': 'RPG',
  'Super Mario 64': 'Platformer',
  'The Legend of Zelda: Ocarina of Time': 'Adventure',
  'The Legend of Zelda: Tears of the Kingdom': 'Adventure',
  'The Legend of Zelda: Breath of the Wild': 'Adventure',
  'Animal Crossing: New Horizons': 'Simulation',
  'Mario Kart 8': 'Racing',
  'Splatoon 3': 'FPS',
  'Fall Guys': 'Battle Royale',
  'Among Us': 'Party',
  'VRChat': 'Social',
  'Slime Rancher': 'Simulation',
  'Disney Dreamlight Valley': 'Simulation',
  'The Elder Scrolls V: Skyrim': 'RPG',
  'Red Dead Redemption 2': 'Open World',
};

function getGameCategory(name: string): string | null {
  return GAME_CATEGORIES[name] || null;
}

const FALLBACK_GAMES: TwitchGame[] = [
  { id: '21779', name: 'League of Legends', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-{width}x{height}.jpg' },
  { id: '32982', name: 'Grand Theft Auto V', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-{width}x{height}.jpg' },
  { id: '32399', name: 'Counter-Strike 2', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-{width}x{height}.jpg' },
  { id: '509658', name: 'Just Chatting', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg' },
  { id: '33214', name: 'Fortnite', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-{width}x{height}.jpg' },
  { id: '516575', name: 'VALORANT', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-{width}x{height}.jpg' },
  { id: '27471', name: 'Minecraft', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-{width}x{height}.jpg' },
  { id: '512710', name: 'Call of Duty: Warzone', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512710-{width}x{height}.jpg' },
  { id: '29595', name: 'Dota 2', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/29595-{width}x{height}.jpg' },
  { id: '263490', name: 'Rust', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/263490_IGDB-{width}x{height}.jpg' },
  { id: '511224', name: 'Apex Legends', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/511224-{width}x{height}.jpg' },
  { id: '460630', name: 'Tom Clancy\'s Rainbow Six Siege', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/460630_IGDB-{width}x{height}.jpg' },
  { id: '518203', name: 'Sports', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/518203-{width}x{height}.jpg' },
  { id: '493057', name: "PUBG: BATTLEGROUNDS", boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/493057-{width}x{height}.jpg' },
  { id: '30921', name: 'Rocket League', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/30921-{width}x{height}.jpg' },
  { id: '512953', name: 'Elden Ring', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512953_IGDB-{width}x{height}.jpg' },
  { id: '490100', name: 'Lost Ark', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490100-{width}x{height}.jpg' },
  { id: '386821', name: 'Black Desert Online', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/386821_IGDB-{width}x{height}.jpg' },
  { id: '65632', name: 'DayZ', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/65632-{width}x{height}.jpg' },
  { id: '489171', name: 'Dead by Daylight', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/489171-{width}x{height}.jpg' },
  { id: '19618', name: 'Old School RuneScape', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/19618-{width}x{height}.jpg' },
  { id: '458562', name: 'RuneScape', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/458562-{width}x{height}.jpg' },
  { id: '18122', name: 'World of Warcraft', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/18122-{width}x{height}.jpg' },
  { id: '488552', name: 'Overwatch 2', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/488552-{width}x{height}.jpg' },
  { id: '24241', name: 'Final Fantasy XIV Online', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/24241_IGDB-{width}x{height}.jpg' },
  { id: '515025', name: 'Diablo IV', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/515025-{width}x{height}.jpg' },
  { id: '29307', name: 'Path of Exile', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/29307-{width}x{height}.jpg' },
  { id: '138585', name: 'Hearthstone', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/138585-{width}x{height}.jpg' },
  { id: '490422', name: 'Teamfight Tactics', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490422-{width}x{height}.jpg' },
  { id: '511312', name: 'Escape From Tarkov', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/511312-{width}x{height}.jpg' },
  { id: '491168', name: 'Among Us', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/491168-{width}x{height}.jpg' },
  { id: '491931', name: 'Fall Guys', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/491931-{width}x{height}.jpg' },
  { id: '27284', name: 'Terraria', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/27284-{width}x{height}.jpg' },
  { id: '491115', name: 'Genshin Impact', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/491115-{width}x{height}.jpg' },
  { id: '21548', name: 'StarCraft II', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/21548-{width}x{height}.jpg' },
  { id: '32507', name: 'The Witcher 3: Wild Hunt', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/32507_IGDB-{width}x{height}.jpg' },
  { id: '491487', name: 'Phasmophobia', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/491487-{width}x{height}.jpg' },
  { id: '2748', name: 'Magic: The Gathering', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/2748-{width}x{height}.jpg' },
  { id: '513143', name: 'Baldur\'s Gate 3', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/513143-{width}x{height}.jpg' },
  { id: '494552', name: 'Valheim', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/494552-{width}x{height}.jpg' },
  { id: '32959', name: 'The Elder Scrolls V: Skyrim', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/32959_IGDB-{width}x{height}.jpg' },
  { id: '490744', name: 'Stardew Valley', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490744-{width}x{height}.jpg' },
  { id: '488190', name: 'Pokémon Sword/Shield', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/488190-{width}x{height}.jpg' },
  { id: '461067', name: 'Legends of Runeterra', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/461067-{width}x{height}.jpg' },
  { id: '518014', name: 'Resident Evil Village', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/518014-{width}x{height}.jpg' },
  { id: '493959', name: 'Red Dead Redemption 2', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/493959-{width}x{height}.jpg' },
  { id: '417752', name: 'Talk Shows & Podcasts', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/417752-{width}x{height}.jpg' },
  { id: '506461', name: 'World of Tanks', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/506461-{width}x{height}.jpg' },
  { id: '506416', name: 'World of Warships', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/506416-{width}x{height}.jpg' },
  { id: '491118', name: 'Destiny 2', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/497057-{width}x{height}.jpg' },
  { id: '505884', name: 'Dark Souls III', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490292-{width}x{height}.jpg' },
  { id: '29433', name: 'Dark Souls', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/29433-{width}x{height}.jpg' },
  { id: '490377', name: 'Sea of Thieves', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490377-{width}x{height}.jpg' },
  { id: '512804', name: 'Hogwarts Legacy', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512804-{width}x{height}.jpg' },
  { id: '517924', name: 'Honkai: Star Rail', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/517924-{width}x{height}.jpg' },
  { id: '519508', name: 'Palworld', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/519508-{width}x{height}.jpg' },
  { id: '491931', name: 'Hades', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/510592-{width}x{height}.jpg' },
  { id: '32383', name: 'The Binding of Isaac: Rebirth', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/32383-{width}x{height}.jpg' },
  { id: '10535', name: 'Hollow Knight', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490846-{width}x{height}.jpg' },
  { id: '491459', name: 'Celeste', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/491459-{width}x{height}.jpg' },
  { id: '313398', name: 'Splatoon 3', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512648-{width}x{height}.jpg' },
  { id: '497057', name: 'Call of Duty: Modern Warfare III', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/1678052513-{width}x{height}.jpg' },
  { id: '6013', name: 'Call of Duty: Black Ops III', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/489401-{width}x{height}.jpg' },
  { id: '26936', name: 'Battlefield 1', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/488980-{width}x{height}.jpg' },
  { id: '512093', name: 'Battlefield 2042', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512093-{width}x{height}.jpg' },
  { id: '33214', name: 'The Sims 4', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/369252-{width}x{height}.jpg' },
  { id: '7251', name: 'Cities: Skylines', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/369252-{width}x{height}.jpg' },
  { id: '12924', name: 'Age of Empires II', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/13389-{width}x{height}.jpg' },
  { id: '512636', name: 'Age of Empires IV', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512636-{width}x{height}.jpg' },
  { id: '21353', name: 'Civilization VI', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/492552-{width}x{height}.jpg' },
  { id: '27053', name: 'Crusader Kings III', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512236-{width}x{height}.jpg' },
  { id: '491115', name: 'Total War: Warhammer III', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512673-{width}x{height}.jpg' },
  { id: '6564', name: 'XCOM 2', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/490154-{width}x{height}.jpg' },
  { id: '20714', name: 'Warframe', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/66170-{width}x{height}.jpg' },
  { id: '29452', name: 'Virtual Casino', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/29452-{width}x{height}.jpg' },
  { id: '509659', name: 'Slots', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/509659-{width}x{height}.jpg' },
  { id: '509660', name: 'Poker', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/509660-{width}x{height}.jpg' },
  { id: '743', name: 'Chess', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/743-{width}x{height}.jpg' },
  { id: '23936', name: 'Don\'t Starve Together', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/287260-{width}x{height}.jpg' },
  { id: '32507', name: 'Satisfactory', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/508455-{width}x{height}.jpg' },
  { id: '488635', name: 'Factorio', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/488635-{width}x{height}.jpg' },
  { id: '491000', name: 'Roblox', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/23020-{width}x{height}.jpg' },
  { id: '11450', name: 'VRChat', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/499003-{width}x{height}.jpg' },
  { id: '32982', name: 'Disney Dreamlight Valley', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/1612756642-{width}x{height}.jpg' },
  { id: '7563', name: 'Slime Rancher', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/488621-{width}x{height}.jpg' },
  { id: '512980', name: 'MultiVersus', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512980-{width}x{height}.jpg' },
  { id: '16282', name: 'Super Smash Bros. Ultimate', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/504461-{width}x{height}.jpg' },
  { id: '20447', name: 'Super Smash Bros. Melee', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/16282-{width}x{height}.jpg' },
  { id: '1229', name: 'Super Mario 64', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/1229-{width}x{height}.jpg' },
  { id: '2692', name: 'The Legend of Zelda: Ocarina of Time', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/11557-{width}x{height}.jpg' },
  { id: '493597', name: 'The Legend of Zelda: Tears of the Kingdom', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/493597-{width}x{height}.jpg' },
  { id: '493597', name: 'The Legend of Zelda: Breath of the Wild', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/493597-{width}x{height}.jpg' },
  { id: '8933', name: 'Animal Crossing: New Horizons', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/509538-{width}x{height}.jpg' },
  { id: '6369', name: 'Mario Kart 8', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/313558-{width}x{height}.jpg' },
  { id: '374245', name: 'Mario Party Superstars', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512700-{width}x{height}.jpg' },
  { id: '16466', name: 'Spider-Man', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/497480-{width}x{height}.jpg' },
  { id: '15866', name: 'Uncharted 4: A Thief\'s End', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/461457-{width}x{height}.jpg' },
  { id: '29552', name: 'God of War', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/6369-{width}x{height}.jpg' },
  { id: '514974', name: 'God of War Ragnarök', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/514974-{width}x{height}.jpg' },
  { id: '22566', name: 'Bloodborne', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/460636-{width}x{height}.jpg' },
  { id: '459064', name: 'Sekiro: Shadows Die Twice', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/506415-{width}x{height}.jpg' },
  { id: '6556', name: 'Monster Hunter: World', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/497467-{width}x{height}.jpg' },
  { id: '9431', name: 'Monster Hunter Rise', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/511352-{width}x{height}.jpg' },
  { id: '497480', name: 'Dragon Ball FighterZ', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/497480-{width}x{height}.jpg' },
  { id: '488615', name: 'Street Fighter 6', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/9431-{width}x{height}.jpg' },
  { id: '8365', name: 'Tekken 8', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/515481-{width}x{height}.jpg' },
  { id: '19619', name: 'Mortal Kombat 1', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/518284-{width}x{height}.jpg' },
  { id: '26566', name: 'NBA 2K24', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/518012-{width}x{height}.jpg' },
  { id: '12924', name: 'FIFA 23', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/1869092879-{width}x{height}.jpg' },
  { id: '512938', name: 'EA Sports FC 24', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/1181770504-{width}x{height}.jpg' },
  { id: '30921', name: 'Fall Guys', boxArt: 'https://static-cdn.jtvnw.net/ttv-boxart/512980-{width}x{height}.jpg' },
];

const formatTwitchBoxArt = (url: string | undefined, width: number = 285, height: number = 380): string | undefined => {
  if (!url) return undefined;
  return url.replace('{width}', String(width)).replace('{height}', String(height));
};

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLevelModalVisible, setIsLevelModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSearchTab, setActiveSearchTab] = useState<'all' | 'users' | 'games' | 'clips' | 'reels' | 'screenshots'>('all');


  const searchInputRef = useRef<TextInput>(null);
  const { getAccessToken, user } = useAuth();
  const router = useRouter();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  

  const topGamesQuery = useInfiniteQuery({
    queryKey: ['games', 'top'],
    queryFn: async ({ pageParam }) => {
      try {
        const token = await getAccessToken();
        console.log('[Explore] Fetching top games, cursor:', pageParam);
        const result = await api.games.getTopGames(20, token || undefined, pageParam);
        console.log('[Explore] Received top games:', result.games?.length, 'nextCursor:', result.nextCursor);
        if (result.games && result.games.length > 0) {
          return result;
        }
        console.log('[Explore] No games from API, using fallback games');
        return { games: FALLBACK_GAMES, nextCursor: undefined };
      } catch (error) {
        console.log('[Explore] API error, using fallback games:', error);
        return { games: FALLBACK_GAMES, nextCursor: undefined };
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
  const { refetch: refetchTopGames, fetchNextPage, hasNextPage, isFetchingNextPage } = topGamesQuery;

  const allGames = React.useMemo(() => 
    topGamesQuery.data?.pages.flatMap(page => page.games) || []
  , [topGamesQuery.data?.pages]);

  const searchQuery_api = useQuery({
    queryKey: ['games', 'search', debouncedSearch],
    queryFn: async () => {
      const trimmedSearch = debouncedSearch?.trim() || '';
      if (!trimmedSearch || trimmedSearch.length === 0) {
        console.log('[Explore] Skipping API search - empty query');
        return { games: [] as TwitchGame[] };
      }
      try {
        const token = await getAccessToken();
        console.log('[Explore] Searching games via API:', trimmedSearch);
        const result = await api.games.searchGames(trimmedSearch, 50, token || undefined);
        console.log('[Explore] API search returned:', result.games?.length, 'games');
        return result;
      } catch (error) {
        console.error('[Explore] Search API error:', error);
        return { games: [] as TwitchGame[] };
      }
    },
    enabled: !!debouncedSearch && debouncedSearch.trim().length > 0,
    staleTime: 30 * 1000,
  });

  const usersSearchQuery = useQuery({
    queryKey: ['users', 'search', debouncedSearch],
    queryFn: async () => {
      const trimmedSearch = debouncedSearch?.trim() || '';
      if (!trimmedSearch || trimmedSearch.length === 0) {
        return { users: [] as SearchUser[] };
      }
      try {
        const token = await getAccessToken();
        console.log('[Explore] Searching users via API:', trimmedSearch);
        const result = await api.users.search(trimmedSearch, token || undefined);
        console.log('[Explore] API user search returned:', result.users?.length, 'users');
        return result;
      } catch (error) {
        console.error('[Explore] User search API error:', error);
        return { users: [] as SearchUser[] };
      }
    },
    enabled: !!debouncedSearch && debouncedSearch.trim().length > 0,
    staleTime: 30 * 1000,
  });

  const combinedSearchQuery = useQuery({
    queryKey: ['search', 'combined', debouncedSearch],
    queryFn: async () => {
      const trimmedSearch = debouncedSearch?.trim() || '';
      if (!trimmedSearch) return { clips: [] as Clip[], reels: [] as Clip[], screenshots: [] as Screenshot[] };
      try {
        const token = await getAccessToken();
        const result = await api.search.search(trimmedSearch, token || undefined);
        return {
          clips: (result.clips || []).filter((c: Clip) => c.videoType === 'clip'),
          reels: (result.reels || (result.clips || []).filter((c: Clip) => c.videoType === 'reel')),
          screenshots: result.screenshots || [],
        };
      } catch (error) {
        console.error('[Explore] Combined search error:', error);
        return { clips: [] as Clip[], reels: [] as Clip[], screenshots: [] as Screenshot[] };
      }
    },
    enabled: !!debouncedSearch && debouncedSearch.trim().length > 0,
    staleTime: 30 * 1000,
  });

  const apiSearchResults = React.useMemo(() => 
    searchQuery_api.data?.games || []
  , [searchQuery_api.data?.games]);

  useEffect(() => {
    console.log('[Explore] Query States:', {
      topGames: { loading: topGamesQuery.isLoading, error: !!topGamesQuery.error, data: allGames.length },
    });

    if (topGamesQuery.error) {
      console.error('[Explore] Top games error:', topGamesQuery.error);
    }
  }, [
    topGamesQuery.isLoading, topGamesQuery.error, allGames.length,
  ]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    
    if (isCloseToBottom && hasNextPage && !isFetchingNextPage && !searchQuery.trim()) {
      console.log('[Explore] Loading more games...');
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searchQuery]);

  

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchTopGames();
    setRefreshing(false);
  }, [refetchTopGames]);
  
  const handleGamePress = useCallback((game: Game | TwitchGame) => {
    console.log('[Explore] Selected game:', game.name);
    Keyboard.dismiss();
    const imageUrl = formatTwitchBoxArt(game.boxArt, 285, 380) || formatTwitchBoxArt((game as any).icon, 285, 380) || game.boxArt || (game as any).icon;
    router.push({ 
      pathname: '/game/[id]', 
      params: { 
        id: game.id,
        name: game.name,
        boxArt: imageUrl || '',
      } 
    });
  }, [router]);

  const handleUserPress = useCallback((user: SearchUser) => {
    console.log('[Explore] Selected user:', user.username);
    Keyboard.dismiss();
    router.push({ 
      pathname: '/user/[id]', 
      params: { id: user.id.toString() } 
    });
  }, [router]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setActiveSearchTab('all');
  }, []);



  const displayedGames = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allGames;
    }
    
    // Filter local games that match the search
    const localFiltered = allGames.filter(game => 
      game.name.toLowerCase().includes(query)
    );
    
    // Always prioritize API results when available, then add unique local matches
    if (apiSearchResults.length > 0) {
      const apiIds = new Set(apiSearchResults.map(g => g.id));
      const localOnly = localFiltered.filter(g => !apiIds.has(g.id));
      // Put API results first (they're more relevant), then local matches
      const combined = [...apiSearchResults, ...localOnly];
      console.log('[Explore] Combined results:', combined.length, '(api:', apiSearchResults.length, ', local unique:', localOnly.length, ')');
      return combined;
    }
    
    // If API search is still loading, show local filtered as preview
    // Once API returns, it will update automatically
    if (searchQuery_api.isLoading) {
      console.log('[Explore] API loading, showing local filtered:', localFiltered.length);
      return localFiltered;
    }
    
    // API finished but no results - just show local filtered
    console.log('[Explore] Local filtered games:', localFiltered.length, 'for query:', query);
    return localFiltered;
  }, [searchQuery, allGames, apiSearchResults, searchQuery_api.isLoading]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />
      
      <AppHeader onOpenLevelTracker={() => setIsLevelModalVisible(true)} />

      <View style={styles.contentHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Explore Games</Text>
          <Text style={styles.subtitle}>Browse games and discover amazing content from the community</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search color="#64748B" size={18} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search games or users..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <X color="#64748B" size={16} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {topGamesQuery.isLoading && !searchQuery.trim() ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading games...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={400}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4ADE80"
              colors={['#4ADE80']}
            />
          }
        >
          {searchQuery.trim().length > 0 ? (
            <>
              {/* Search Tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.searchTabsScroll}
                contentContainerStyle={styles.searchTabsContent}
              >
                {([
                  { key: 'all', label: 'All', icon: <Search size={14} color={activeSearchTab === 'all' ? '#131F2A' : '#94A3B8'} /> },
                  { key: 'users', label: 'Users', icon: <User size={14} color={activeSearchTab === 'users' ? '#131F2A' : '#94A3B8'} /> },
                  { key: 'games', label: 'Games', icon: <Gamepad2 size={14} color={activeSearchTab === 'games' ? '#131F2A' : '#94A3B8'} /> },
                  { key: 'clips', label: 'Clips', icon: <Film size={14} color={activeSearchTab === 'clips' ? '#131F2A' : '#94A3B8'} /> },
                  { key: 'reels', label: 'Reels', icon: <Video size={14} color={activeSearchTab === 'reels' ? '#131F2A' : '#94A3B8'} /> },
                  { key: 'screenshots', label: 'Screenshots', icon: <Camera size={14} color={activeSearchTab === 'screenshots' ? '#131F2A' : '#94A3B8'} /> },
                ] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.searchTab, activeSearchTab === tab.key && styles.searchTabActive]}
                    onPress={() => setActiveSearchTab(tab.key)}
                  >
                    {tab.icon}
                    <Text style={[styles.searchTabText, activeSearchTab === tab.key && styles.searchTabTextActive]}>
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {(searchQuery_api.isLoading || usersSearchQuery.isLoading || combinedSearchQuery.isLoading) ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#4ADE80" size="large" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : (
                <>
                  {/* Users Section */}
                  {(activeSearchTab === 'all' || activeSearchTab === 'users') && (usersSearchQuery.data?.users?.length || 0) > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <User size={18} color="#4ADE80" />
                        <Text style={styles.sectionTitle}>Users</Text>
                      </View>
                      <View style={styles.usersGrid}>
                        {usersSearchQuery.data?.users?.map((user) => (
                          <TouchableOpacity
                            key={user.id}
                            style={styles.userCard}
                            onPress={() => handleUserPress(user)}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={{ uri: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }}
                              style={styles.userAvatar}
                            />
                            <View style={styles.userInfo}>
                              <Text style={styles.userDisplayName} numberOfLines={1}>{user.displayName || user.username}</Text>
                              <Text style={styles.userUsername} numberOfLines={1}>@{user.username}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Games Section */}
                  {(activeSearchTab === 'all' || activeSearchTab === 'games') && displayedGames.length > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Gamepad2 size={18} color="#4ADE80" />
                        <Text style={styles.sectionTitle}>Games</Text>
                      </View>
                      <View style={styles.gamesGrid}>
                        {displayedGames.map((game, index) => {
                          const imageUrl = formatTwitchBoxArt(game.boxArt, 285, 380) || formatTwitchBoxArt(game.icon, 285, 380);
                          return (
                            <TouchableOpacity
                              key={`${game.id}-${index}`}
                              style={styles.gameCard}
                              onPress={() => handleGamePress(game)}
                              activeOpacity={0.7}
                            >
                              {imageUrl ? (
                                <Image source={{ uri: imageUrl }} style={styles.gameImage} resizeMode="cover" />
                              ) : (
                                <View style={styles.gameImagePlaceholder}>
                                  <Play color="#4ADE80" size={24} />
                                </View>
                              )}
                              <View style={styles.gameInfo}>
                                <Text style={styles.gameName} numberOfLines={2}>{game.name}</Text>
                                {getGameCategory(game.name) ? (
                                  <View style={styles.categoryTag}>
                                    <Text style={styles.categoryTagText}>{getGameCategory(game.name)}</Text>
                                  </View>
                                ) : (
                                  <Text style={styles.gameSubtext}>Tap to explore</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </>
                  )}

                  {/* Clips Section */}
                  {(activeSearchTab === 'all' || activeSearchTab === 'clips') && (combinedSearchQuery.data?.clips?.length || 0) > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Film size={18} color="#4ADE80" />
                        <Text style={styles.sectionTitle}>Clips</Text>
                      </View>
                      <View style={styles.mediaGrid}>
                        {combinedSearchQuery.data?.clips?.map((clip) => (
                          <TouchableOpacity
                            key={clip.id}
                            style={styles.mediaCard}
                            onPress={() => router.push({ pathname: '/clips/[id]', params: { id: clip.id.toString() } })}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={{ uri: clip.thumbnailUrl || 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=300&h=180&fit=crop' }}
                              style={styles.mediaThumbnail}
                              resizeMode="cover"
                            />
                            <View style={styles.mediaOverlay}>
                              <Film size={16} color="#FFF" />
                            </View>
                            <View style={styles.mediaInfo}>
                              <Text style={styles.mediaTitle} numberOfLines={1}>{clip.title}</Text>
                              <Text style={styles.mediaSubtext} numberOfLines={1}>{clip.user?.displayName || clip.user?.username}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Reels Section */}
                  {(activeSearchTab === 'all' || activeSearchTab === 'reels') && (combinedSearchQuery.data?.reels?.length || 0) > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Video size={18} color="#4ADE80" />
                        <Text style={styles.sectionTitle}>Reels</Text>
                      </View>
                      <View style={styles.mediaGrid}>
                        {combinedSearchQuery.data?.reels?.map((reel) => (
                          <TouchableOpacity
                            key={reel.id}
                            style={styles.mediaCard}
                            onPress={() => router.push({ pathname: '/clips/[id]', params: { id: reel.id.toString() } })}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={{ uri: reel.thumbnailUrl || 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=300&h=180&fit=crop' }}
                              style={styles.mediaThumbnail}
                              resizeMode="cover"
                            />
                            <View style={styles.mediaOverlay}>
                              <Video size={16} color="#FFF" />
                            </View>
                            <View style={styles.mediaInfo}>
                              <Text style={styles.mediaTitle} numberOfLines={1}>{reel.title}</Text>
                              <Text style={styles.mediaSubtext} numberOfLines={1}>{reel.user?.displayName || reel.user?.username}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Screenshots Section */}
                  {(activeSearchTab === 'all' || activeSearchTab === 'screenshots') && (combinedSearchQuery.data?.screenshots?.length || 0) > 0 && (
                    <>
                      <View style={styles.sectionHeader}>
                        <Camera size={18} color="#4ADE80" />
                        <Text style={styles.sectionTitle}>Screenshots</Text>
                      </View>
                      <View style={styles.mediaGrid}>
                        {combinedSearchQuery.data?.screenshots?.map((shot: Screenshot) => (
                          <TouchableOpacity
                            key={shot.id}
                            style={styles.mediaCard}
                            onPress={() => router.push({ pathname: '/screenshot/[id]', params: { id: shot.id.toString() } })}
                            activeOpacity={0.7}
                          >
                            <Image
                              source={{ uri: shot.imageUrl || 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=300&h=180&fit=crop' }}
                              style={styles.mediaThumbnail}
                              resizeMode="cover"
                            />
                            <View style={styles.mediaOverlay}>
                              <Camera size={16} color="#FFF" />
                            </View>
                            <View style={styles.mediaInfo}>
                              <Text style={styles.mediaTitle} numberOfLines={1}>{shot.title}</Text>
                              <Text style={styles.mediaSubtext} numberOfLines={1}>{shot.user?.displayName || shot.user?.username}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {/* Empty State */}
                  {(activeSearchTab === 'all' && 
                    (usersSearchQuery.data?.users?.length || 0) === 0 &&
                    displayedGames.length === 0 &&
                    (combinedSearchQuery.data?.clips?.length || 0) === 0 &&
                    (combinedSearchQuery.data?.reels?.length || 0) === 0 &&
                    (combinedSearchQuery.data?.screenshots?.length || 0) === 0) ||
                  (activeSearchTab === 'users' && (usersSearchQuery.data?.users?.length || 0) === 0) ||
                  (activeSearchTab === 'games' && displayedGames.length === 0) ||
                  (activeSearchTab === 'clips' && (combinedSearchQuery.data?.clips?.length || 0) === 0) ||
                  (activeSearchTab === 'reels' && (combinedSearchQuery.data?.reels?.length || 0) === 0) ||
                  (activeSearchTab === 'screenshots' && (combinedSearchQuery.data?.screenshots?.length || 0) === 0) ? (
                    <View style={styles.emptyContainer}>
                      <View style={styles.emptyIcon}>
                        <Search size={40} color="#4ADE80" />
                      </View>
                      <Text style={styles.emptyTitle}>No results found</Text>
                      <Text style={styles.emptyMessage}>Try a different keyword or search tab</Text>
                    </View>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <View style={styles.gamesGrid}>
              {displayedGames.map((game, index) => {
                const imageUrl = formatTwitchBoxArt(game.boxArt, 285, 380) || formatTwitchBoxArt(game.icon, 285, 380);
                return (
                  <TouchableOpacity
                    key={`${game.id}-${index}`}
                    style={styles.gameCard}
                    onPress={() => handleGamePress(game)}
                    activeOpacity={0.7}
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.gameImage}
                        resizeMode="cover"
                        onError={(e) => {
                          console.log('[Explore] Image load error for', game.name, ':', e.nativeEvent.error);
                        }}
                      />
                    ) : (
                      <View style={styles.gameImagePlaceholder}>
                        <Play color="#4ADE80" size={24} />
                      </View>
                    )}
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameName} numberOfLines={2}>{game.name}</Text>
                      {getGameCategory(game.name) ? (
                        <View style={styles.categoryTag}>
                          <Text style={styles.categoryTagText}>{getGameCategory(game.name)}</Text>
                        </View>
                      ) : (
                        <Text style={styles.gameSubtext}>Tap to explore</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {isFetchingNextPage && !searchQuery.trim() && (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator color="#4ADE80" size="small" />
              <Text style={styles.loadMoreText}>Loading more games...</Text>
            </View>
          )}
        </ScrollView>
      )}

      <LevelDetailsModal
        visible={isLevelModalVisible}
        onClose={() => setIsLevelModalVisible(false)}
        level={user?.level || 1}
        currentXP={user?.totalXP || 0}
        userId={user?.id?.toString()}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  contentHeader: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  searchContainer: {
    position: 'relative',
    zIndex: 20,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: 6,
    marginLeft: 4,
  },
  searchDropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#1E2D3C',
    borderRadius: 12,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#2D3748',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      },
    }),
  },
  searchResultsList: {
    maxHeight: 350,
  },
  searchSectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  searchResultIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2D3748',
  },
  searchResultIconRound: {
    borderRadius: 22,
  },
  searchResultIconHash: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  searchResultCategory: {
    fontSize: 12,
    color: '#64748B',
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  searchLoadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  noResults: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#64748B',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 5,
    top: 240,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#131F2A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingBottom: 100,
    gap: 10,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  gameCard: {
    width: '47%',
    backgroundColor: '#1E2D3C',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    marginHorizontal: '1.5%',
  },
  gameImage: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: '#2D3748',
  },
  gameImagePlaceholder: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: '#2D3748',
    justifyContent: 'center',
    alignItems: 'center',
  },

  gameInfo: {
    padding: 12,
  },
  gameName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  gameSubtext: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#4ADE8022',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#4ADE8044',
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  titleContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  usersGrid: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  searchTabsScroll: {
    maxHeight: 48,
  },
  searchTabsContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  searchTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  searchTabActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  searchTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  searchTabTextActive: {
    color: '#131F2A',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  mediaCard: {
    width: '47%',
    backgroundColor: '#1E2D3C',
    borderRadius: 10,
    overflow: 'hidden',
  },
  mediaThumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#2D3748',
  },
  mediaOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    padding: 4,
  },
  mediaInfo: {
    padding: 8,
  },
  mediaTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  mediaSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2D3C',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D3748',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userDisplayName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 13,
    color: '#64748B',
  },
});


