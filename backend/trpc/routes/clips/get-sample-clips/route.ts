import { publicProcedure } from "../../../create-context";

export default publicProcedure.query(async () => {
  console.log('[tRPC] Fetching sample clips');

  const sampleClips = [
    {
      id: 1001,
      userId: 999999,
      title: 'Insane 360 No-Scope!',
      description: 'Best shot of my career',
      videoUrl: 'https://example.com/video1.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
      duration: 45,
      views: 12500,
      videoType: 'clip',
      game: {
        id: '1',
        name: 'Call of Duty',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/512710-{width}x{height}.jpg'
      },
      _count: {
        likes: 342,
        comments: 28,
      },
      createdAt: new Date('2025-01-15').toISOString(),
    },
    {
      id: 1002,
      userId: 999999,
      title: 'Epic Victory Royale',
      description: '1v4 clutch',
      videoUrl: 'https://example.com/video2.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop',
      duration: 62,
      views: 8900,
      videoType: 'clip',
      game: {
        id: '2',
        name: 'Fortnite',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-{width}x{height}.jpg'
      },
      _count: {
        likes: 289,
        comments: 19,
      },
      createdAt: new Date('2025-01-14').toISOString(),
    },
    {
      id: 1003,
      userId: 999999,
      title: 'Perfect Headshot',
      description: 'Sniper gameplay',
      videoUrl: 'https://example.com/video3.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=450&fit=crop',
      duration: 38,
      views: 15200,
      videoType: 'clip',
      game: {
        id: '3',
        name: 'Valorant',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-{width}x{height}.jpg'
      },
      _count: {
        likes: 412,
        comments: 34,
      },
      createdAt: new Date('2025-01-13').toISOString(),
    },
    {
      id: 1004,
      userId: 999999,
      title: 'Amazing Comeback',
      description: 'Never give up!',
      videoUrl: 'https://example.com/video4.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&h=450&fit=crop',
      duration: 89,
      views: 6700,
      videoType: 'clip',
      game: {
        id: '4',
        name: 'Apex Legends',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/511224-{width}x{height}.jpg'
      },
      _count: {
        likes: 198,
        comments: 15,
      },
      createdAt: new Date('2025-01-12').toISOString(),
    },
    {
      id: 1005,
      userId: 999999,
      title: 'Quick Montage',
      description: 'Best plays this week',
      videoUrl: 'https://example.com/video5.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1591405351990-4726e331f141?w=450&h=800&fit=crop',
      duration: 28,
      views: 19800,
      videoType: 'reel',
      game: {
        id: '1',
        name: 'Call of Duty',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/512710-{width}x{height}.jpg'
      },
      _count: {
        likes: 523,
        comments: 41,
      },
      createdAt: new Date('2025-01-11').toISOString(),
    },
    {
      id: 1006,
      userId: 999999,
      title: 'Funny Moments',
      description: 'LOL',
      videoUrl: 'https://example.com/video6.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1563207153-f403bf289096?w=450&h=800&fit=crop',
      duration: 35,
      views: 22400,
      videoType: 'reel',
      game: {
        id: '2',
        name: 'Fortnite',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-{width}x{height}.jpg'
      },
      _count: {
        likes: 671,
        comments: 52,
      },
      createdAt: new Date('2025-01-10').toISOString(),
    },
  ];

  return sampleClips;
});
