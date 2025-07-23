const referralService = require("../bot/services/referralService");
const databaseService = require("../bot/config/database");

jest.mock("../bot/config/database");
jest.mock("../bot/services/notificationService", () => ({
  getNotificationServiceInstance: () => ({
    sendNotification: jest.fn(),
  }),
}));

describe("ReferralService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should prevent self-referral", async () => {
    databaseService.referralCodes.mockReturnValue({
      where: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [
                {
                  data: () => ({
                    code: "ABC123",
                    userId: "user1",
                    active: true,
                  }),
                  id: "ref1",
                },
              ],
            }),
          }),
        }),
      }),
      doc: () => ({ update: jest.fn() }),
    });
    const result = await referralService.validateReferralCode({
      code: "ABC123",
      companyId: "comp1",
      buyerTelegramId: "user1",
    });
    expect(result.valid).toBe(false);
    expect(result.message).toBe("You cannot refer yourself.");
  });

  it("should expire code after use", async () => {
    let updated = false;
    databaseService.referralCodes.mockReturnValue({
      where: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({
              empty: false,
              docs: [
                {
                  data: () => ({
                    code: "ABC123",
                    userId: "user2",
                    active: true,
                  }),
                  id: "ref2",
                },
              ],
            }),
          }),
        }),
      }),
      doc: () => ({
        update: async () => {
          updated = true;
        },
      }),
    });
    const result = await referralService.validateReferralCode({
      code: "ABC123",
      companyId: "comp1",
      buyerTelegramId: "user3",
    });
    expect(result.valid).toBe(true);
    expect(updated).toBe(true);
  });

  it("should reject already used/expired code", async () => {
    databaseService.referralCodes.mockReturnValue({
      where: () => ({
        where: () => ({
          where: () => ({
            get: async () => ({ empty: true }),
          }),
        }),
      }),
    });
    const result = await referralService.validateReferralCode({
      code: "EXPIRED",
      companyId: "comp1",
      buyerTelegramId: "user4",
    });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/already used/i);
  });
});
