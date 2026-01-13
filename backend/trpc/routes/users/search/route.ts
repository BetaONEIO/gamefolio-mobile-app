import { z } from "zod";
import { protectedProcedure } from "../../../create-context";

const mockUsers = [
  { id: 2, username: 'names21080', displayName: 'names21080', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop', isOnline: false },
  { id: 3, username: 'Arrowking96', displayName: 'Arrowking96', avatarUrl: 'https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100&h=100&fit=crop', isOnline: true },
  { id: 4, username: 'JawaTheGathering', displayName: 'JawaTheGathering', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', isOnline: true },
  { id: 5, username: 'Leumas', displayName: 'Leumas', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop', isOnline: false },
  { id: 6, username: 'GamerPro99', displayName: 'GamerPro99', avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop', isOnline: false },
  { id: 7, username: 'PlayerOne', displayName: 'PlayerOne', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', isOnline: true },
  { id: 8, username: 'NightOwl', displayName: 'NightOwl', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', isOnline: false },
  { id: 9, username: 'ShadowStrike', displayName: 'ShadowStrike', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop', isOnline: true },
  { id: 10, username: 'CyberNinja', displayName: 'CyberNinja', avatarUrl: 'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=100&h=100&fit=crop', isOnline: false },
];

const searchUsersRoute = protectedProcedure
  .input(z.object({
    query: z.string().min(1),
  }))
  .query(async ({ ctx, input }) => {
    console.log('[Users] Searching users with query:', input.query, 'by user:', ctx.userId);
    
    const results = mockUsers.filter(user => 
      user.username.toLowerCase().includes(input.query.toLowerCase()) ||
      user.displayName.toLowerCase().includes(input.query.toLowerCase())
    );
    
    return results.filter(user => user.id !== ctx.userId);
  });

export default searchUsersRoute;
