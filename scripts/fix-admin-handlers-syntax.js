const fs = require("fs");
const path = require("path");

const adminHandlersPath = path.join(
  __dirname,
  "../bot/handlers/adminHandlers.js"
);

console.log("🔧 Fixing admin handlers syntax...");

try {
  // Read the admin handlers file
  let content = fs.readFileSync(adminHandlersPath, "utf8");

  // Fix incomplete method definitions
  content = content.replace(
    /async handleAdminUserDetail\(ctx, userId\) \{\s*try \{\s*if \(!\(await this\.isAdminAsync\(ctx\.from\.id\)\)\)\s*return ctx\.reply\(t\("msg__access_denied", \{\}/g,
    `async handleAdminUserDetail(ctx, userId) {
    try {
      if (!(await this.isAdminAsync(ctx.from.id)))
        return ctx.reply(t("msg__access_denied", {}, ctx.session?.language || "en"));
      
      const user = await userService.getUserByTelegramId(userId);
      if (!user) return ctx.reply(t("msg__user_not_found", {}, ctx.session?.language || "en"));
      
      let msg = \`👤 *User Details*\\n\\n\`;
      msg += \`📱 Name: \${user.firstName || user.first_name || 'Unknown'} \${user.lastName || user.last_name || ''}\\n\`;
      msg += \`🆔 ID: \${user.telegramId || user.id}\\n\`;
      msg += \`👤 Username: @\${user.username || 'N/A'}\\n\`;
      msg += \`📞 Phone: \${user.phone_number || user.phone || 'N/A'}\\n\`;
      msg += \`💰 Balance: $\${(user.referralBalance || 0).toFixed(2)}\\n\`;
      msg += \`🎯 Role: \${user.role || 'user'}\\n\`;
      msg += \`📅 Joined: \${toDateSafe(user.createdAt) ? toDateSafe(user.createdAt).toLocaleDateString() : 'N/A'}\\n\`;
      msg += \`🏢 Can Register Company: \${user.canRegisterCompany ? '✅ Yes' : '❌ No'}\\n\`;
      msg += \`🚫 Banned: \${user.isBanned ? '✅ Yes' : '❌ No'}\\n\`;
      
      const buttons = [
        [
          Markup.button.callback(
            user.isBanned ? "🔓 Unban User" : "🚫 Ban User",
            user.isBanned ? \`unban_user_\${userId}\` : \`ban_user_\${userId}\`
          ),
        ],
        [
          Markup.button.callback(
            user.canRegisterCompany ? "⬇️ Demote User" : "⬆️ Promote User",
            user.canRegisterCompany ? \`demote_user_id_\${userId}\` : \`promote_user_id_\${userId}\`
          ),
        ],
        [Markup.button.callback("🔙 Back to Users", "all_users_menu_1")],
      ];
      
      ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard(buttons),
      });
      if (ctx.callbackQuery) ctx.answerCbQuery();
    } catch (error) {
      logger.error("Error showing user detail:", error);
      ctx.reply(t("msg__failed_to_load_user_details", {}, ctx.session?.language || "en"));
      if (ctx.callbackQuery) ctx.answerCbQuery();
    }
  }`
  );

  // Remove duplicate method definitions
  const methodRegex = /async\s+handle(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\n\s*\}/g;
  const methods = new Map();
  let match;

  while ((match = methodRegex.exec(content)) !== null) {
    const methodName = match[1];
    const methodBody = match[0];

    if (!methods.has(methodName)) {
      methods.set(methodName, methodBody);
    } else {
      // Keep the more complete implementation
      const existingBody = methods.get(methodName);
      if (methodBody.length > existingBody.length) {
        methods.set(methodName, methodBody);
      }
    }
  }

  // Rebuild the file content
  let cleanedContent = content.substring(
    0,
    content.indexOf("class AdminHandlers {")
  );
  cleanedContent += "class AdminHandlers {\n";
  cleanedContent += "  constructor() {\n";
  cleanedContent += "    this.adminIds = process.env.ADMIN_IDS\n";
  cleanedContent +=
    '      ? process.env.ADMIN_IDS.split(",").map((id) => parseInt(id))\n';
  cleanedContent += "      : [];\n";
  cleanedContent += "  }\n\n";

  // Add all unique methods
  methods.forEach((methodBody, methodName) => {
    cleanedContent += methodBody + "\n\n";
  });

  cleanedContent += "}\n\nmodule.exports = new AdminHandlers();";

  // Write the cleaned content
  fs.writeFileSync(adminHandlersPath, cleanedContent, "utf8");

  console.log("✅ Fixed admin handlers syntax");
  console.log(`📊 Total methods: ${methods.size}`);
} catch (error) {
  console.error("❌ Error fixing syntax:", error.message);
  process.exit(1);
}
