import { protectedProcedure } from "../../../create-context";

const getBlockedUsersRoute = protectedProcedure.query(async ({ ctx }) => {
  console.log('[Users] Getting blocked users for user:', ctx.userId);
  
  return [];
});

export default getBlockedUsersRoute;
