const userService = require("../bot/services/userService").userService;
const referralService = require("../bot/services/referralService");

jest.mock("../bot/config/database", () => ({
  users: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          telegramId: 123456789,
          firstName: "Test",
          lastName: "User",
          username: "testuser",
        }),
      }),
      set: jest.fn().mockResolvedValue(true),
      update: jest.fn(),
    })),
    where: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    })),
  })),
  companies: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({ name: "Test Company", codePrefix: "TEST" }),
      }),
    })),
  })),
  referralCodes: jest.fn(() => {
    const chain = {
      where: jest.fn(() => chain),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            data: () => ({ code: "ABC123", userId: "user1", active: true }),
            id: "ref1",
          },
        ],
      }),
      add: jest.fn().mockResolvedValue({ id: "ref1" }),
      doc: jest.fn(() => ({ update: jest.fn().mockResolvedValue(true) })),
    };
    return chain;
  }),
}));
jest.mock("../bot/services/notificationService", () => ({
  getNotificationServiceInstance: () => ({ sendNotification: jest.fn() }),
}));

describe("User Service", () => {
  describe("createUser", () => {
    it("should create a new user", async () => {
      const userData = {
        telegramId: 123456789,
        firstName: "Test",
        lastName: "User",
        username: "testuser",
      };

      const userId = await userService.createUser(userData);
      expect(userId).toBeDefined();
    });
  });

  describe("getUserByTelegramId", () => {
    it("should return user by telegram ID", async () => {
      const user = await userService.getUserByTelegramId(123456789);
      expect(user).toBeDefined();
      expect(user.telegramId).toBe(123456789);
    });
  });
});

describe("Referral Service", () => {
  describe("generateReferralCode", () => {
    it("should generate a unique referral code", async () => {
      const code = await referralService.generateReferralCode(
        123456789,
        "company123"
      );
      expect(code).toMatch(/^([A-Z0-9]{8}|TEST-[A-Z0-9]{6})$/);
    });
  });

  describe("validateReferralCode", () => {
    it("should validate referral code", async () => {
      const code = "TEST1234";
      const result = await referralService.validateReferralCode(code);
      expect(result).toBeDefined();
    });
  });
});
