const userService = require("../bot/services/userService").userService;
const databaseService = require("../bot/config/database");

jest.mock("../bot/config/database");

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
    const result = await userService.createOrUpdateUser(userData);
    expect(result.id).toBeDefined();
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
    databaseService.users.mockReturnValue({
      doc: () => ({
        update: jest.fn().mockResolvedValue(true),
        get: async () => ({ data: () => ({ username: "olduser" }) }),
      }),
    });
    const result = await userService.updateUser("u1", { username: "newuser" });
    expect(result.username).toBe("newuser");
  });
});
