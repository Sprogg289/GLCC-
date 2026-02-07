require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ChannelType,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  AuditLogEvent,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const fs = require("fs");

/* ==========================================================
   1. CONFIGURATION SECTION
   ========================================================== */
const config = {
  // Authentication & IDs
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // Channel & Category IDs
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  supportRoleId: process.env.SUPPORT_ROLE_ID,
  devRoleId: process.env.DEV_ROLE_ID, // NEW: Developer Role
  ticketPanelChannelId: process.env.TICKET_PANEL_CHANNEL_ID,
  applicationPanelChannelId: process.env.APPLICATION_PANEL_CHANNEL_ID,
  applicationReviewChannel: process.env.APPLICATION_REVIEW_CHANNEL_ID,
  transcriptChannel: process.env.TRANSCRIPT_CHANNEL_ID,
  botStatsLog: process.env.BOT_STATS_LOG_ID,

  // Global UI Settings
  embeds: {
    color: 0x55fe5c,
    footerText: "GL CC Team",
    ticketPanel: {
      title: "🎫 Support Tickets",
      description: "Need help? Select a category below to open a private ticket with our staff team."
    },
    appPanel: {
      title: "📄 Applications",
      description: "Interested in joining our team or partnering with us? Select the form below to start."
    },
    welcomeTicket: {
      title: "🎫 Ticket Opened",
      description: "Welcome! Please describe your inquiry in detail. Our support team will assist you shortly."
    },
    appStarted: {
      title: "Application Started",
      description: "Please answer the questions following this message in your DMs."
    },
    statsLog: {
      title: "🤖 Bot Status Update",
      onlineMsg: "The bot is now online and monitoring the server."
    }
  }
};

/* ==========================================================
   2. APPLICATION QUESTIONS
   ========================================================== */
const applications = {
  staff: {
    name: "Staff Application",
    emoji: "🛡️",
    questions: [
      "Requirements check: Do you own 2+ DLCs, speak English, and have a stable connection? (Yes/No)",
      "What is your Name?",
      "What is your Discord Name?",
      "Are you over the age of 18?",
      "Please provide a link to your TruckersMP Account.",
      "Do you lag in TMP?",
      "What Role are you applying for?",
      "Why do you want to apply for CC?",
      "Do you have any CC experience?",
      "What DLCs do you own?",
      "How many hours do you have in ETS2?",
      "What SCS software titles do you currently own/play?",
      "Tell us a bit about yourself (hobbies, etc).",
      "What can YOU bring to the table?",
      "How did you find us?"
    ]
  },
};

/* ==========================================================
   3. TRACKING & STATE MANAGEMENT
   ========================================================== */
const startTime = Date.now();
const commandUsage = new Map();
const activeApplications = new Map();

/* ==========================================================
   4. CLIENT INITIALIZATION
   ========================================================== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

/* ==========================================================
   5. SLASH COMMAND REGISTRATION
   ========================================================== */
const commands = [
  // Utility
  new SlashCommandBuilder().setName("help").setDescription("Display all available bot commands"),
  new SlashCommandBuilder().setName("panel").setDescription("Deploy ticket/app panels (Staff only)"),
  new SlashCommandBuilder().setName("devlog").setDescription("Display bot stats (Staff only)"),
  new SlashCommandBuilder().setName("convoy").setDescription("Start a convoy mini-game"),
  
  // Moderation
  new SlashCommandBuilder().setName("warn").setDescription("Warn a user")
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)),
  
  new SlashCommandBuilder().setName("unwarn").setDescription("Revoke a warning (Log only)")
    .addUserOption(o => o.setName("user").setDescription("User to unwarn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("kick").setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("ban").setDescription("Ban a user")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder().setName("unban").setDescription("Unban a user ID")
    .addStringOption(o => o.setName("userid").setDescription("ID of user to unban").setRequired(true)),

  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a user")
    .addUserOption(o => o.setName("user").setDescription("User to timeout").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder().setName("untimeout").setDescription("Remove timeout")
    .addUserOption(o => o.setName("user").setDescription("User to untimeout").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log("[SYSTEM] Refreshing commands...");
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log("[SYSTEM] Commands refreshed.");
  } catch (error) {
    console.error("[ERROR] Command refresh failed:", error);
  }
})();

/* ==========================================================
   6. UTILITY FUNCTIONS
   ========================================================== */
function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.has(config.supportRoleId) || member.roles.cache.has(config.devRoleId) || member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function getUptime() {
  let totalSeconds = (Date.now() - startTime) / 1000;
  let days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = Math.floor(totalSeconds % 60);
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

async function sendAutoLog(embed) {
  try {
    const channel = await client.channels.fetch(config.botStatsLog);
    if (channel) channel.send({ embeds: [embed] });
  } catch (e) {}
}

/* ==========================================================
   7. AUTO-LOGGING EVENTS
   ========================================================== */
// (Existing logging logic preserved)
client.on(Events.MessageDelete, async message => {
  if (!message.guild || message.author?.bot) return;
  sendAutoLog(new EmbedBuilder().setTitle("🗑️ Deleted").setDescription(`**Author:** ${message.author?.tag}\n**Content:** ${message.content?.substring(0, 1000)}`).setColor(0xFF4B4B));
});
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
  sendAutoLog(new EmbedBuilder().setTitle("📝 Edited").setDescription(`**Author:** ${oldMsg.author?.tag}\n**Before:** ${oldMsg.content?.substring(0, 500)}\n**After:** ${newMsg.content?.substring(0, 500)}`).setColor(0xFFCC4B));
});
client.on(Events.GuildMemberAdd, member => sendAutoLog(new EmbedBuilder().setTitle("📥 Joined").setDescription(`${member.user.tag}`).setColor(0x55FE5C)));
client.on(Events.GuildMemberRemove, member => sendAutoLog(new EmbedBuilder().setTitle("📤 Left").setDescription(`${member.user.tag}`).setColor(0x808080)));

/* ==========================================================
   8. READY EVENT
   ========================================================== */
client.once(Events.ClientReady, async () => {
  console.log(`[AUTH] Logged in as ${client.user.tag}`);
});

/* ==========================================================
   9. INTERACTION HANDLER
   ========================================================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    // --- MODALS (Application Reason Logic) ---
    if (interaction.isModalSubmit()) {
      const [action, userId] = interaction.customId.split("_"); // e.g., ["accept", "12345"]
      
      if (action === "accept" || action === "decline") {
        const reason = interaction.fields.getTextInputValue("reasonInput");
        const status = action === "accept" ? "Accepted" : "Declined";
        const color = action === "accept" ? 0x55FE5C : 0xFF4B4B;

        // 1. DM User
        try {
          const user = await client.users.fetch(userId);
          const dmEmbed = new EmbedBuilder()
            .setTitle(`Application Update: ${status}`)
            .setDescription(`Your application for **Green Light CC** has been **${status}**.`)
            .addFields({ name: "Reason/Feedback", value: reason })
            .setColor(color)
            .setFooter({ text: config.embeds.footerText });
          await user.send({ embeds: [dmEmbed] });
        } catch (e) {
          console.log(`Could not DM user ${userId}`);
        }

        // 2. Update Log Message
        const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
        originalEmbed.addFields({ name: `Reviewed by ${interaction.user.username}`, value: `**Status:** ${status}\n**Reason:** ${reason}` });
        originalEmbed.setColor(color);

        await interaction.update({ embeds: [originalEmbed], components: [] }); // Remove buttons
        return;
      }
    }

    // --- SLASH COMMANDS ---
    if (interaction.isChatInputCommand()) {
      const { commandName, options } = interaction;

      // MODERATION COMMANDS
      if (["kick", "ban", "unban", "timeout", "untimeout", "warn", "unwarn"].includes(commandName)) {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Permission Denied.", ephemeral: true });

        const targetUser = options.getUser("user");
        const reason = options.getString("reason") || "No reason provided";

        if (commandName === "warn") {
          try { await targetUser.send(`⚠️ **You have been warned in ${interaction.guild.name}**\nReason: ${reason}`); } catch {}
          interaction.reply({ content: `✅ Warned ${targetUser.tag}.`, ephemeral: true });
          return sendAutoLog(new EmbedBuilder().setTitle("⚠️ Member Warned").addFields({ name: "User", value: targetUser.tag }, { name: "Mod", value: interaction.user.tag }, { name: "Reason", value: reason }).setColor(0xFFFF00));
        }

        if (commandName === "unwarn") {
          interaction.reply({ content: `✅ Warning revoked for ${targetUser.tag} (Logged).`, ephemeral: true });
          return sendAutoLog(new EmbedBuilder().setTitle("🛡️ Warning Revoked").addFields({ name: "User", value: targetUser.tag }, { name: "Mod", value: interaction.user.tag }, { name: "Note", value: reason }).setColor(0x00FF00));
        }

        const targetMember = targetUser ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;

        if (commandName === "kick") {
          if (!targetMember) return interaction.reply({ content: "User not found.", ephemeral: true });
          await targetMember.kick(reason);
          interaction.reply({ content: `👢 Kicked ${targetUser.tag}.` });
        }

        if (commandName === "ban") {
          if (!targetMember) return interaction.reply({ content: "User not found.", ephemeral: true });
          await targetMember.ban({ reason });
          interaction.reply({ content: `🔨 Banned ${targetUser.tag}.` });
        }

        if (commandName === "unban") {
          const userId = options.getString("userid");
          await interaction.guild.members.unban(userId);
          interaction.reply({ content: `🔓 Unbanned ID ${userId}.` });
        }

        if (commandName === "timeout") {
          if (!targetMember) return interaction.reply({ content: "User not found.", ephemeral: true });
          const mins = options.getInteger("minutes");
          await targetMember.timeout(mins * 60 * 1000, reason);
          interaction.reply({ content: `🤐 Timed out ${targetUser.tag} for ${mins}m.` });
        }

        if (commandName === "untimeout") {
          if (!targetMember) return interaction.reply({ content: "User not found.", ephemeral: true });
          await targetMember.timeout(null);
          interaction.reply({ content: `🗣️ Removed timeout from ${targetUser.tag}.` });
        }
        return;
      }

      // EXISTING COMMANDS
      if (commandName === "help") {
        const helpEmbed = new EmbedBuilder()
          .setTitle("📜 Bot Command Help")
          .setDescription("Full list of commands:")
          .addFields(
            { name: "🛡️ Moderation", value: "`/warn`, `/unwarn`, `/kick`, `/ban`, `/unban`, `/timeout`, `/untimeout`" },
            { name: "🛠️ Admin", value: "`/panel`, `/devlog`" },
            { name: "🚛 General", value: "`/help`, `/convoy`" }
          )
          .setColor(config.embeds.color);
        return interaction.reply({ embeds: [helpEmbed] });
      }

      if (commandName === "panel") {
         if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
         
         const ticketChannel = await client.channels.fetch(config.ticketPanelChannelId);
         const appChannel = await client.channels.fetch(config.applicationPanelChannelId);

         const tMenu = new StringSelectMenuBuilder().setCustomId("ticket_select").setPlaceholder("Contact Support").addOptions({ label: "Support", value: "support", emoji: "🛠️" }, { label: "Report", value: "report", emoji: "⚠️" });
         const aMenu = new StringSelectMenuBuilder().setCustomId("application_select").setPlaceholder("Apply Now").addOptions(Object.keys(applications).map(k => ({ label: applications[k].name, value: k, emoji: applications[k].emoji })));

         await ticketChannel?.send({ embeds: [new EmbedBuilder().setTitle(config.embeds.ticketPanel.title).setDescription(config.embeds.ticketPanel.description).setColor(config.embeds.color)], components: [new ActionRowBuilder().addComponents(tMenu)] });
         await appChannel?.send({ embeds: [new EmbedBuilder().setTitle(config.embeds.appPanel.title).setDescription(config.embeds.appPanel.description).setColor(config.embeds.color)], components: [new ActionRowBuilder().addComponents(aMenu)] });
         return interaction.reply({ content: "✅ Panels deployed.", ephemeral: true });
      }

      if (commandName === "devlog") {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🛠️ Status").addFields({ name: "Uptime", value: getUptime() }).setColor(config.embeds.color)] });
      }
      
      if (commandName === "convoy") {
         return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🚛 Convoy").setDescription("Status: 🟠 Checks pending").setColor(config.embeds.color)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("convoy_check").setLabel("Check").setStyle(ButtonStyle.Primary))] });
      }
    }

    // --- BUTTONS (Applications & Convoy) ---
    if (interaction.isButton()) {
      // Application Review Buttons
      if (interaction.customId.startsWith("app_accept_") || interaction.customId.startsWith("app_decline_")) {
        const userId = interaction.customId.split("_")[2];
        const action = interaction.customId.startsWith("app_accept") ? "accept" : "decline";

        const modal = new ModalBuilder()
          .setCustomId(`${action}_${userId}`)
          .setTitle(`${action === "accept" ? "Accept" : "Decline"} Application`);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reasonInput")
          .setLabel("Reason / Feedback")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
        return;
      }

      if (interaction.customId === "convoy_check") {
        const success = Math.random() > 0.3;
        interaction.update({ 
           embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setFields({ name: "Status", value: success ? "✅ Passed" : "❌ Failed" })],
           components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("convoy_check").setLabel("Re-check").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("convoy_start").setLabel("Depart").setStyle(ButtonStyle.Success).setDisabled(!success))]
        });
      }
      if (interaction.customId === "convoy_start") {
        interaction.update({ embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setTitle("🚛 Rolling out!").setFields({ name: "Status", value: "🟢 En route" })], components: [] });
      }
      if (interaction.customId === "ticket_close") {
        interaction.reply("Closing...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      }
    }

    // --- SELECT MENUS ---
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "ticket_select") {
        const ch = await interaction.guild.channels.create({ name: `${interaction.values[0]}-${interaction.user.username}`, type: ChannelType.GuildText, parent: config.ticketCategoryId });
        ch.send({ content: `<@&${config.supportRoleId}>`, embeds: [new EmbedBuilder().setTitle("Ticket").setDescription("Staff will arrive shortly.")], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger))] });
        interaction.reply({ content: `Ticket: ${ch}`, ephemeral: true });
      }
      if (interaction.customId === "application_select") {
        const app = applications[interaction.values[0]];
        activeApplications.set(interaction.user.id, { app, answers: [], index: 0 });
        interaction.user.send({ embeds: [new EmbedBuilder().setTitle(app.name).setDescription(`Q1: ${app.questions[0]}`)] }).then(() => interaction.reply({ content: "Check DMs", ephemeral: true })).catch(() => interaction.reply({ content: "DMs closed", ephemeral: true }));
      }
    }
  } catch (e) { console.error(e); }
});

/* ==========================================================
   10. DM HANDLING
   ========================================================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.channel.isDMBased()) return;
  const data = activeApplications.get(message.author.id);
  if (!data) return;

  data.answers.push(`**Q${data.index + 1}:** ${data.app.questions[data.index]}\n**A:** ${message.content}`);
  data.index++;

  if (data.index < data.app.questions.length) {
    message.channel.send({ embeds: [new EmbedBuilder().setTitle("Next Question").setDescription(`Q${data.index + 1}: ${data.app.questions[data.index]}`)] });
  } else {
    activeApplications.delete(message.author.id);
    message.channel.send("✅ Application Submitted!");
    
    // Send to Review Channel with Buttons
    try {
      const reviewChannel = await client.channels.fetch(config.applicationReviewChannel);
      const fileName = `app-${message.author.id}.txt`;
      fs.writeFileSync(fileName, data.answers.join("\n\n"));
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`app_accept_${message.author.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`app_decline_${message.author.id}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
      );

      await reviewChannel.send({ 
        content: `🆕 **App from ${message.author}**`, 
        files: [new AttachmentBuilder(fileName)],
        embeds: [new EmbedBuilder().setTitle(data.app.name).setDescription(`User: ${message.author.tag} (${message.author.id})`).setColor(config.embeds.color)],
        components: [row]
      });
      fs.unlinkSync(fileName);
    } catch (err) {}
  }
});

client.login(config.token);
