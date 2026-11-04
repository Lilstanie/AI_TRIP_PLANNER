const state = () => globalThis.__accountDeletionClerk;

export const auth = async () => ({ userId: state().userId });

export const clerkClient = async () => ({
  users: {
    deleteUser: async (userId) => {
      state().deleted.push(userId);
      if (state().failDelete) throw new Error("injected Clerk deletion failure");
    },
  },
});
