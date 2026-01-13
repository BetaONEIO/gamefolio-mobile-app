import { publicProcedure } from "../../../create-context";

export default publicProcedure.query(async () => {
  console.log('[tRPC] Fetching sample screenshots');

  const sampleScreenshots = [
    {
      id: 2001,
      userId: 999999,
      title: 'Beautiful Sunset in Skyrim',
      description: 'Graphics on max settings',
      thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&h=675&fit=crop',
      views: 8900,
      game: {
        id: '5',
        name: 'Skyrim',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/30028-{width}x{height}.jpg'
      },
      _count: {
        likes: 234,
        comments: 18,
      },
      createdAt: new Date('2025-01-14').toISOString(),
    },
    {
      id: 2002,
      userId: 999999,
      title: 'Epic Boss Fight',
      description: 'Finally defeated him!',
      thumbnailUrl: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=1200&h=675&fit=crop',
      views: 5600,
      game: {
        id: '6',
        name: 'Elden Ring',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/512953-{width}x{height}.jpg'
      },
      _count: {
        likes: 187,
        comments: 12,
      },
      createdAt: new Date('2025-01-13').toISOString(),
    },
    {
      id: 2003,
      userId: 999999,
      title: 'My Custom Character',
      description: 'Took 2 hours to create',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=675&fit=crop',
      views: 12300,
      game: {
        id: '7',
        name: 'Cyberpunk 2077',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/65876-{width}x{height}.jpg'
      },
      _count: {
        likes: 456,
        comments: 29,
      },
      createdAt: new Date('2025-01-12').toISOString(),
    },
    {
      id: 2004,
      userId: 999999,
      title: 'Perfect Landing',
      description: 'Stuck the landing!',
      thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=675&fit=crop',
      views: 7800,
      game: {
        id: '8',
        name: 'GTA V',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/32982-{width}x{height}.jpg'
      },
      _count: {
        likes: 321,
        comments: 24,
      },
      createdAt: new Date('2025-01-11').toISOString(),
    },
  ];

  return sampleScreenshots;
});
