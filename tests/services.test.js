const userService = require("../services/userService");
const referralService = require("../services/referralService");

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
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
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
