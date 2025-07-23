const userService = require("../bot/services/userService").userService;
const databaseService = require("../bot/config/database");

jest.mock("../bot/config/database", () => {
  let usersData = {};
  return {
    users: jest.fn(() => ({
      doc: jest.fn((id) => ({
        get: jest.fn().mockImplementation(() => {
          if (usersData[id]) {
            return Promise.resolve({ exists: true, data: () => usersData[id] });
          }
          return Promise.resolve({ exists: false });
        }),
        set: jest.fn().mockImplementation((data) => {
          usersData[id] = data;
          return Promise.resolve(true);
        }),
        update: jest.fn().mockImplementation((data) => {
          usersData[id] = { ...usersData[id], ...data };
          return Promise.resolve(true);
        }),
      })),
      where: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
    })),
  };
});
jest.mock("../bot/services/notificationService", () => ({
  getNotificationServiceInstance: () => ({ sendNotification: jest.fn() }),
}));

describe("UserService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a new user", async () => {
    databaseService.users.mockReturnValue({
      doc: () => ({
        get: async () => ({ exists: false }),
        set: jest.fn().mockResolvedValue(true),
        update: jest.fn(),
      }),
    });
    const userData = {
      telegramId: "u1",
      firstName: "Test",
      lastName: "User",
      username: "testuser",
    };
    // Ensure user does not exist in mock
    const databaseService = require("../bot/config/database");
    delete databaseService.users().doc(userData.telegramId).usersData;
    const userId = await userService.createOrUpdateUser(userData);
    expect(userId).toBeDefined();
    expect(result.first_name).toBe("Test");
  });

  it("should verify phone if valid and unique", async () => {
    databaseService.users.mockReturnValue({
      where: () => ({ get: async () => ({ empty: true, docs: [] }) }),
      doc: () => ({
        get: async () => ({ data: () => ({}) }),
        update: jest.fn().mockResolvedValue(true),
      }),
    });
    const result = await userService.verifyPhone("u1", "+251911234567");
    expect(result.phone_verified).toBe(true);
  });

  it("should reject duplicate phone number", async () => {
    databaseService.users.mockReturnValue({
      where: () => ({
        get: async () => ({ empty: false, docs: [{ id: "u2" }] }),
      }),
      doc: () => ({
        get: async () => ({ data: () => ({}) }),
        update: jest.fn(),
      }),
    });
    await expect(
      userService.verifyPhone("u1", "+251911234567")
    ).rejects.toThrow(/already registered/);
  });

  it("should update username if changed", async () => {
    // Ensure user exists in mock
    const databaseService = require("../bot/config/database");
    databaseService.users().doc("u1").set({ username: "olduser" });
    const result = await userService.updateUser("u1", { username: "newuser" });
    expect(result.username).toBe("newuser");
  });
});
