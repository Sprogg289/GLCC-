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
  AttachmentBuilder
} = require("discord.js");

const fs = require("fs");

/* ================= CONFIG ================= */
const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  supportRoleId: process.env.SUPPORT_ROLE_ID,

  ticketPanelChannelId: process.env.TICKET_PANEL_CHANNEL_ID,
  applicationPanelChannelId: process.env.APPLICATION_PANEL_CHANNEL_ID,
  applicationReviewChannel: process.env.APPLICATION_REVIEW_CHANNEL_ID,
  transcriptChannel: process.env.TRANSCRIPT_CHANNEL_ID,
  botStatsLog: process.env.BOT_STATS_Log,

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

/* ================= TRACKING ================= */
const startTime = Date.now();
const commandUsage = new Map();

/* ================= APPLICATIONS ================= */
const applications = {
  partnership: {
    name: "Partnership Form",
    questions: ["What is your Name?", "Company Name?", "Discord Username?", "Tell us about your company."]
  },
  staff: {
    name: "Staff Application",
    questions: ["Your Name?", "Your Discord Name?", "Why do you want to join staff?"]
  }
};

/* ================= CLIENT ================= */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

const activeApplications = new Map();

/* ================= COMMANDS ================= */
const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Display all available bot commands"),
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Deploy ticket and application panels (Staff only)"),
  new SlashCommandBuilder()
    .setName("devlog")
    .setDescription("Display bot statistics and development status (Staff only)"),
  new SlashCommandBuilder()
    .setName("convoy")
    .setDescription("Start a mini-game to manage a convoy departure")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error refreshing commands:", error);
  }
})();

/* ================= HELPERS ================= */
function isStaff(member) {
  return member.roles.cache.has(config.supportRoleId);
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

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  if (config.botStatsLog) {
    try {
      const statsChannel = await client.channels.fetch(config.botStatsLog);
      const statsEmbed = new EmbedBuilder()
        .setTitle(config.embeds.statsLog.title)
        .setDescription(config.embeds.statsLog.onlineMsg)
        .setColor(config.embeds.color)
        .setFooter({ text: config.embeds.footerText })
        .setTimestamp();
      statsChannel.send({ embeds: [statsEmbed] });
    } catch (err) { console.error("Stats Log failed:", err); }
  }
});

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const current = commandUsage.get(interaction.commandName) || 0;
      commandUsage.set(interaction.commandName, current + 1);
    }

    // --- HELP COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === "help") {
      const helpEmbed = new EmbedBuilder()
        .setTitle("📜 Bot Command Help")
        .setDescription("Welcome to the **Convoy & Ticket System**. Here are all available commands:")
        .addFields(
          { name: "🛠️ Staff Commands", value: "`/panel` - Deploy Tickets/App panels\n`/devlog` - View system status" },
          { name: "🚛 General Commands", value: "`/help` - Show this list\n`/convoy` - Start a convoy mini-game" },
          { name: "🎫 Tickets", value: "Use the panel select menu to open a support ticket." },
          { name: "📄 Applications", value: "Use the application panel to join the team." }
        )
        .setColor(config.embeds.color)
        .setFooter({ text: config.embeds.footerText });
      return interaction.reply({ embeds: [helpEmbed] });
    }

    // --- CONVOY MINI-GAME ---
    if (interaction.isChatInputCommand() && interaction.commandName === "convoy") {
      const convoyEmbed = new EmbedBuilder()
        .setTitle("🚛 Convoy Command Center")
        .setDescription("Ready to depart? Perform pre-convoy checks below!")
        .addFields({ name: "Status", value: "🟠 Waiting for checks..." })
        .setColor(config.embeds.color)
        .setFooter({ text: config.embeds.footerText });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("convoy_check").setLabel("Check Vehicles").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("convoy_start").setLabel("Depart Now!").setStyle(ButtonStyle.Success).setDisabled(true)
      );

      return interaction.reply({ embeds: [convoyEmbed], components: [row] });
    }

    // Handle Convoy Buttons
    if (interaction.isButton()) {
      if (interaction.customId === "convoy_check") {
        const editedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setFields({ name: "Status", value: "✅ All vehicles inspected. Ready for departure!" });
        const enabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("convoy_check").setLabel("Check Vehicles").setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId("convoy_start").setLabel("Depart Now!").setStyle(ButtonStyle.Success)
        );
        return interaction.update({ embeds: [editedEmbed], components: [enabledRow] });
      }

      if (interaction.customId === "convoy_start") {
        const finalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setTitle("🚛 Convoy is Rolling!")
          .setDescription(`Departure led by **${interaction.user.username}**. Drive safe!`)
          .setFields({ name: "Status", value: "🟢 En route to destination." });
        return interaction.update({ embeds: [finalEmbed], components: [] });
      }

      if (interaction.customId === "ticket_close") {
        await interaction.reply("Closing ticket...");
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
      }
    }

    // --- DEVLOG ---
    if (interaction.isChatInputCommand() && interaction.commandName === "devlog") {
      if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      let mostUsed = "None";
      let maxCount = 0;
      commandUsage.forEach((count, name) => { if (count > maxCount) { maxCount = count; mostUsed = `/${name} (${count})`; } });

      const devLogEmbed = new EmbedBuilder()
        .setTitle("🛠️ Development & Status Log")
        .setColor(config.embeds.color)
        .addFields(
          { name: "⏱️ Uptime", value: getUptime(), inline: true },
          { name: "📊 Most Used Command", value: mostUsed, inline: true },
          { name: "🐛 Bug Status", value: "System healthy.", inline: false }
        )
        .setFooter({ text: config.embeds.footerText });
      return interaction.reply({ embeds: [devLogEmbed] });
    }

    // --- PANEL DEPLOY ---
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
      if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
      
      const ticketChannel = await client.channels.fetch(config.ticketPanelChannelId);
      const appChannel = await client.channels.fetch(config.applicationPanelChannelId);

      const tMenu = new StringSelectMenuBuilder().setCustomId("ticket_select").setPlaceholder("Select ticket type").addOptions(
        { label: "Support", value: "support" }, { label: "Report", value: "report" }
      );
      const aMenu = new StringSelectMenuBuilder().setCustomId("application_select").setPlaceholder("Select application").addOptions(
        Object.keys(applications).map(k => ({ label: applications[k].name, value: k }))
      );

      await ticketChannel.send({
        embeds: [new EmbedBuilder().setTitle(config.embeds.ticketPanel.title).setDescription(config.embeds.ticketPanel.description).setColor(config.embeds.color).setFooter({ text: config.embeds.footerText })],
        components: [new ActionRowBuilder().addComponents(tMenu)]
      });

      await appChannel.send({
        embeds: [new EmbedBuilder().setTitle(config.embeds.appPanel.title).setDescription(config.embeds.appPanel.description).setColor(config.embeds.color).setFooter({ text: config.embeds.footerText })],
        components: [new ActionRowBuilder().addComponents(aMenu)]
      });

      return interaction.reply({ content: "✅ Panels deployed.", ephemeral: true });
    }

    // --- SELECT MENUS ---
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "ticket_select") {
        const channel = await interaction.guild.channels.create({
          name: `${interaction.values[0]}-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: config.ticketCategoryId,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
            { id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel] }
          ]
        });
        const welcome = new EmbedBuilder().setTitle(config.embeds.welcomeTicket.title).setDescription(config.embeds.welcomeTicket.description).setFooter({ text: config.embeds.footerText }).setColor(config.embeds.color);
        await channel.send({ content: `${interaction.user}`, embeds: [welcome], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("ticket_close").setLabel("Close").setStyle(ButtonStyle.Danger))] });
        return interaction.reply({ content: `🎫 Ticket: ${channel}`, ephemeral: true });
      }

      if (interaction.customId === "application_select") {
        const app = applications[interaction.values[0]];
        activeApplications.set(interaction.user.id, { app, answers: [], index: 0 });
        const start = new EmbedBuilder().setTitle(`Started: ${app.name}`).setDescription(`Q1: ${app.questions[0]}`).setFooter({ text: config.embeds.footerText }).setColor(config.embeds.color);
        try { 
          await interaction.user.send({ embeds: [start] }); 
          return interaction.reply({ content: "📬 Check DMs.", ephemeral: true }); 
        } catch (e) { 
          return interaction.reply({ content: "❌ DMs off.", ephemeral: true }); 
        }
      }
    }
  } catch (err) {
    console.error("Interaction Error:", err);
  }
});

/* ================= MESSAGE LOGIC (APPS) ================= */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.channel.isDMBased()) return;
  const data = activeApplications.get(message.author.id);
  if (!data) return;

  data.answers.push(`Q: ${data.app.questions[data.index]}\nA: ${message.content}`);
  data.index++;

  if (data.index < data.app.questions.length) {
    message.channel.send({ embeds: [new EmbedBuilder().setTitle(data.app.name).setDescription(`Q${data.index + 1}: ${data.app.questions[data.index]}`).setFooter({ text: config.embeds.footerText }).setColor(config.embeds.color)] });
  } else {
    activeApplications.delete(message.author.id);
    message.channel.send({ embeds: [new EmbedBuilder().setTitle("Submitted").setDescription("✅ Your application has been sent.").setFooter({ text: config.embeds.footerText }).setColor(config.embeds.color)] });
    
    try {
      const reviewChannel = await client.channels.fetch(config.applicationReviewChannel);
      const fileName = `app-${message.author.username}.txt`;
      fs.writeFileSync(fileName, data.answers.join("\n\n"));
      await reviewChannel.send({ content: `New Application: ${message.author.tag}`, files: [new AttachmentBuilder(fileName)] });
      fs.unlinkSync(fileName);
    } catch (err) { console.error("Review send failed:", err); }
  }
});

client.login(config.token);
