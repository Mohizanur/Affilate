const { Markup } = require("telegraf");
const userService = require("../services/userService").userService;
const { t, getAvailableLocales } = require("../../utils/localize");
const logger = require("../../utils/logger");

module.exports = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const currentLanguage = await userService.getUserLanguage(telegramId);
    const availableLocales = getAvailableLocales();

    // Create language selection keyboard
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(
          currentLanguage === "en" ? "🇺🇸 English ✓" : "🇺🇸 English",
          "language_en"
        ),
        Markup.button.callback(
          currentLanguage === "am" ? "🇪🇹 አማርኛ ✓" : "🇪🇹 አማርኛ",
          "language_am"
        ),
      ],
      [Markup.button.callback("🔙 Back to Menu", "main_menu")],
    ]);

    const message =
      currentLanguage === "am"
        ? "🌐 *የቋንቋ ምርጫ*\n\nእባክዎ የሚፈልጉትን ቋንቋ ይምረጡ:"
        : "🌐 *Language Selection*\n\nPlease choose your preferred language:";

    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...keyboard,
    });
  } catch (error) {
    logger.error("Error in language command:", error);
    await ctx.reply(t("error_generic", {}, currentLanguage));
  }
};
