const companyHandlers = require('../handlers/companyHandlers');
const adminHandlers = require('../handlers/adminHandlers');
const userService = require('../services/userService');

module.exports = async (ctx) => {
    const telegramId = ctx.from.id;
    const user = await userService.userService.getUserByTelegramId(telegramId);
    if (user && (user.role === 'admin' || user.isAdmin === true)) {
        // Admin: show full company management panel
        return adminHandlers.handleCompanyManagement(ctx);
    } else if (user && (user.isCompanyOwner || user.companyId)) {
        // Company owner: show their dashboard
        return companyHandlers.handleCompanyDashboard(ctx);
    } else {
        // Not allowed
        return ctx.reply("❌ You don't have permission to access company management. Contact an admin if you believe this is an error.");
    }
};
