import { publicProcedure } from "../../../create-context";

export default publicProcedure.query(async () => {
  console.log('[tRPC] Fetching sample favorite games');

  const sampleFavorites = [
    {
      id: '1',
      name: 'Call of Duty: Modern Warfare',
      imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/512710-{width}x{height}.jpg'
    },
    {
      id: '2',
      name: 'Fortnite',
      imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-{width}x{height}.jpg'
    },
    {
      id: '3',
      name: 'Valorant',
      imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-{width}x{height}.jpg'
    },
    {
      id: '4',
      name: 'Apex Legends',
      imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/511224-{width}x{height}.jpg'
    },
    {
      id: '5',
      name: 'The Elder Scrolls V: Skyrim',
      imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/30028-{width}x{height}.jpg'
    },
    {
      id: '6',
      name: 'Elden Ring',
      imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/512953-{width}x{height}.jpg'
    },
  ];

  return sampleFavorites;
});
