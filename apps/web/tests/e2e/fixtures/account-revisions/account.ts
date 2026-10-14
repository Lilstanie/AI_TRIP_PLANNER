export const useAccount = () => ({
  status: "signed-in",
  userId: localStorage.getItem("fixture.user") ?? "fixture-user",
});
