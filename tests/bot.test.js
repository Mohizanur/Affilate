const request = require("supertest");
const app = require("../server");

describe("Bot API", () => {
  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health").expect(200);

      expect(response.body.status).toBe("OK");
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe("GET /api/companies", () => {
    it("should return list of companies", async () => {
      const response = await request(app).get("/api/companies").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("POST /api/webhook", () => {
    it("should handle webhook requests", async () => {
      const webhookData = {
        update_id: 123,
        message: {
          message_id: 1,
          from: {
            id: 123456789,
            first_name: "Test",
            username: "testuser",
          },
          chat: {
            id: 123456789,
            type: "private",
          },
          date: Math.floor(Date.now() / 1000),
          text: "/start",
        },
      };

      await request(app).post("/api/webhook").send(webhookData).expect(200);
    });
  });
});
