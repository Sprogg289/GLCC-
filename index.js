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
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  supportRoleId: process.env.SUPPORT_ROLE_ID,
  devRoleId: process.env.DEV_ROLE_ID, // Developer Role ID
  ticketPanelChannelId: process.env.TICKET_PANEL_CHANNEL_ID,
  applicationPanelChannelId: process.env.APPLICATION_PANEL_CHANNEL_ID,
  applicationReviewChannel: process.env.APPLICATION_REVIEW_CHANNEL_ID,
  transcriptChannel: process.env.TRANSCRIPT_CHANNEL_ID,
  botStatsLog: process.env.BOT_STATS_LOG_ID,

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
      "Requirements: Own at least 2 DLCs, VC capable, English speaking. Do you meet these? (Yes/No)",
      "What is your name?",
      "Discord username?",
      "Are you 18+?",
      "TruckersMP Account link:",
      "Do you lag in TMP?",
      "Role applying for?",
      "Why GL CC?",
      "Experience?",
      "DLCs owned?",
      "ETS2 Hours?",
      "Tell us about yourself & hobbies.",
      "What can YOU bring to the table?",
      "How did you find us?"
    ]
  },
};

/* ==========================================================
   3. TRACKING & STATE
   ========================================================== */
const startTime = Date.now();
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
  new SlashCommandBuilder().setName("help").setDescription("Display all available bot commands"),
  new SlashCommandBuilder().setName("panel").setDescription("Deploy ticket and application panels"),
  new SlashCommandBuilder().setName("devlog").setDescription("Display bot stats"),
  new SlashCommandBuilder().setName("convoy").setDescription("Start a convoy mini-game"),
  
  // Moderation Commands
  new SlashCommandBuilder().setName("warn").setDescription("Warn a member")
    .addUserOption(o => o.setName("user").setDescription("The user to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for warning").setRequired(true)),
  new SlashCommandBuilder().setName("unwarn").setDescription("Revoke a warning (Log entry only)")
    .addUserOption(o => o.setName("user").setDescription("The user to unwarn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for removal").setRequired(true)),
  new SlashCommandBuilder().setName("kick").setDescription("Kick a member")
    .addUserOption(o => o.setName("user").setDescription("The user to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for kick").setRequired(true)),
  new SlashCommandBuilder().setName("ban").setDescription("Ban a member")
    .addUserOption(o => o.setName("user").setDescription("The user to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for ban")),
  new SlashCommandBuilder().setName("unban").setDescription("Unban a member by ID")
    .addStringOption(o => o.setName("userid").setDescription("ID of the user to unban").setRequired(true)),
  new SlashCommandBuilder().setName("timeout").setDescription("Timeout a member")
    .addUserOption(o => o.setName("user").setDescription("The user to mute").setRequired(true))
    .addIntegerOption(o => o.setName("minutes").setDescription("Duration in minutes").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason for timeout").setRequired(true)),
  new SlashCommandBuilder().setName("untimeout").setDescription("Remove timeout from a member")
    .addUserOption(o => o.setName("user").setDescription("The user to unmute").setRequired(true))
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

async function refreshCommands() {
  try {
    console.log("[SYSTEM] Refreshing Slash Commands...");
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log("[SYSTEM] Slash Commands Registered Successfully.");
  } catch (error) {
    console.error("[ERROR] Slash Command Refresh Failed:", error);
  }
}

/* ==========================================================
   6. UTILITY FUNCTIONS
   ========================================================== */
function isStaff(member) {
  if (!member) return false;
  return (
    member.roles.cache.has(config.supportRoleId) || 
    member.roles.cache.has(config.devRoleId) || 
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
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
   7. AUTO-LOGGING EVENTS (FIXED NULL AUTHOR CRASH)
   ========================================================== */
client.on(Events.MessageDelete, async message => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle("🗑️ Message Deleted")
    .setColor(0xFF4B4B)
    .addFields(
      { name: "Author", value: `${message.author?.tag || "Unknown"}`, inline: true },
      { name: "Content", value: message.content?.substring(0, 1024) || "None" }
    ).setTimestamp();
  sendAutoLog(embed);
});

client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setTitle("📝 Message Edited")
    .setColor(0xFFCC4B)
    .addFields(
      { name: "Author", value: `${oldMsg.author?.tag || "Unknown"}`, inline: true },
      { name: "Before", value: oldMsg.content?.substring(0, 500) || "Empty" },
      { name: "After", value: newMsg.content?.substring(0, 500) || "Empty" }
    ).setTimestamp();
  sendAutoLog(embed);
});

/* ==========================================================
   8. READY EVENT
   ========================================================== */
client.once(Events.ClientReady, async () => {
  console.log(`[AUTH] Logged in as ${client.user.tag}`);
  await refreshCommands();
});

/* ==========================================================
   9. INTERACTION HANDLER
   ========================================================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    // MODAL HANDLING (Accept/Decline Reasons)
    if (interaction.isModalSubmit()) {
      const [action, userId] = interaction.customId.split("_");
      const reason = interaction.fields.getTextInputValue("reasonInput");
      const isAccept = action === "accept";
      
      try {
        const user = await client.users.fetch(userId);
        const embed = new EmbedBuilder()
          .setTitle(`Application ${isAccept ? "Accepted" : "Declined"}`)
          .setDescription(`Your application for GL CC has been **${isAccept ? "Approved" : "Rejected"}**.`)
          .addFields({ name: "Staff Feedback", value: reason })
          .setColor(isAccept ? 0x55FE5C : 0xFF4B4B)
          .setTimestamp();
        await user.send({ embeds: [embed] });
      } catch (e) { console.log("Could not DM user result."); }

      const logEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(isAccept ? 0x55FE5C : 0xFF4B4B)
        .addFields({ name: `Decision by ${interaction.user.tag}`, value: `**Status:** ${isAccept ? "Accepted" : "Declined"}\n**Reason:** ${reason}` });
      
      await interaction.update({ embeds: [logEmbed], components: [] });
      return;
    }

    // SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      const { commandName, options } = interaction;

      // Help
      if (commandName === "help") {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle("Bot Commands").addFields({ name: "Mod", value: "warn, unwarn, kick, ban, unban, timeout, untimeout" }, { name: "Admin", value: "panel, devlog" }).setColor(config.embeds.color)] });
      }

      // Panels
      if (commandName === "panel") {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ No Permission.", ephemeral: true });
        const tChannel = await client.channels.fetch(config.ticketPanelChannelId);
        const aChannel = await client.channels.fetch(config.applicationPanelChannelId);
        
        const tMenu = new StringSelectMenuBuilder().setCustomId("t_sel").setPlaceholder("Support").addOptions({ label: "Support", value: "s", emoji: "🎫" });
        const aMenu = new StringSelectMenuBuilder().setCustomId("a_sel").setPlaceholder("Apply").addOptions(Object.keys(applications).map(k => ({ label: applications[k].name, value: k })));

        await tChannel?.send({ components: [new ActionRowBuilder().addComponents(tMenu)], embeds: [new EmbedBuilder().setTitle("Tickets").setDescription("Open a ticket below.").setColor(config.embeds.color)] });
        await aChannel?.send({ components: [new ActionRowBuilder().addComponents(aMenu)], embeds: [new EmbedBuilder().setTitle("Applications").setDescription("Join our team.").setColor(config.embeds.color)] });
        return interaction.reply({ content: "Panels sent.", ephemeral: true });
      }

      // Moderation Logic
      if (["warn", "kick", "ban", "timeout", "untimeout", "unwarn", "unban"].includes(commandName)) {
        if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
        
        const target = options.getUser("user");
        const reason = options.getString("reason") || "No reason provided";
        const member = target ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;

        if (commandName === "warn") {
          try { await target.send(`⚠️ Warning from ${interaction.guild.name}: ${reason}`); } catch {}
          interaction.reply({ content: `Warned ${target.tag}` });
          return sendAutoLog(new EmbedBuilder().setTitle("Warn").addFields({ name: "User", value: target.tag }, { name: "Reason", value: reason }).setColor(0xFFFF00));
        }

        if (commandName === "kick") {
          if (!member) return interaction.reply("User not found.");
          await member.kick(reason);
          return interaction.reply(`Kicked ${target.tag}`);
        }

        if (commandName === "ban") {
          if (!member) return interaction.reply("User not found.");
          await member.ban({ reason });
          return interaction.reply(`Banned ${target.tag}`);
        }

        if (commandName === "unban") {
          await interaction.guild.members.unban(options.getString("userid"));
          return interaction.reply("User unbanned.");
        }

        if (commandName === "timeout") {
          if (!member) return interaction.reply("User not found.");
          await member.timeout(options.getInteger("minutes") * 60000, reason);
          return interaction.reply(`Timed out ${target.tag}`);
        }

        if (commandName === "untimeout") {
          if (!member) return interaction.reply("User not found.");
          await member.timeout(null);
          return interaction.reply(`Timeout removed from ${target.tag}`);
        }
      }
    }

    // BUTTONS
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("app_")) {
        const [_, action, userId] = interaction.customId.split("_");
        const modal = new ModalBuilder()
          .setCustomId(`${action}_${userId}`)
          .setTitle(`${action === "accept" ? "Accept" : "Decline"} Application`);
        
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId("reasonInput").setLabel("Reason").setStyle(TextInputStyle.Paragraph).setRequired(true)
        ));
        return interaction.showModal(modal);
      }
    }

    // SELECT MENUS
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "a_sel") {
        const app = applications[interaction.values[0]];
        activeApplications.set(interaction.user.id, { app, answers: [], index: 0 });
        interaction.user.send(`Starting ${app.name}. Q1: ${app.questions[0]}`).then(() => interaction.reply({ content: "Check DMs", ephemeral: true })).catch(() => interaction.reply({ content: "DMs closed", ephemeral: true }));
      }
    }
  } catch (e) { console.error(e); }
});

/* ==========================================================
   10. DM HANDLING (APPLICATIONS)
   ========================================================== */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.channel.isDMBased()) return;
  const data = activeApplications.get(message.author.id);
  if (!data) return;

  data.answers.push(`**Q:${data.app.questions[data.index]}**\nA:${message.content}`);
  data.index++;

  if (data.index < data.app.questions.length) {
    message.channel.send(`Q${data.index + 1}: ${data.app.questions[data.index]}`);
  } else {
    activeApplications.delete(message.author.id);
    message.channel.send("✅ Submitted!");
    
    const review = await client.channels.fetch(config.applicationReviewChannel);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_accept_${message.author.id}`).setLabel("Accept").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`app_decline_${message.author.id}`).setLabel("Decline").setStyle(ButtonStyle.Danger)
    );

    const logFile = `app-${message.author.id}.txt`;
    fs.writeFileSync(logFile, data.answers.join("\n\n"));
    await review.send({ content: `New App: ${message.author.tag}`, files: [new AttachmentBuilder(logFile)], components: [row] });
    fs.unlinkSync(logFile);
  }
});

client.login(config.token);
