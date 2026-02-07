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

  // --- CUSTOMIZE EMBED APPEARANCE HERE ---
  embeds: {
    color: 0x55fe5c,
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
      description: "Welcome! Please describe your inquiry in detail. Our support team will assist you shortly.",
      footer: "Our team is here to help!"
    },
    appStarted: {
      title: "Application Started",
      footer: "Please answer all questions honestly."
    },
    statsLog: {
      title: "🤖 Bot Status Update",
      onlineMsg: "The bot is now online and monitoring the server."
    }
  },
  applicationTimeout: 60000
};

/* ================= APPLICATIONS ================= */
const applications = {
  partnership: {
    name: "Partnership Form",
    questions: [
      "What is your Name?",
      "Company Name?",
      "Discord Username?",
      "Tell us about your company."
    ]
  },
  staff: {
    name: "Staff Application",
    questions: [
      "Your Name?",
      "Your Discord Name?",
      "Why do you want to join staff?"
    ]
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
    .setName("panel")
    .setDescription("Deploy ticket and application panels (Staff only)")
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
    console.error(error);
  }
})();

/* ================= READY ================= */
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  // Log status to the custom stats channel
  if (config.botStatsLog) {
    try {
      const statsChannel = await client.channels.fetch(config.botStatsLog);
      const statsEmbed = new EmbedBuilder()
        .setTitle(config.embeds.statsLog.title)
        .setDescription(config.embeds.statsLog.onlineMsg)
        .setColor(config.embeds.color)
        .setTimestamp();
      
      statsChannel.send({ embeds: [statsEmbed] });
    } catch (err) {
      console.error("Could not send to Bot Stats Log channel:", err);
    }
  }
});

/* ================= STAFF CHECK ================= */
function isStaff(member) {
  return member.roles.cache.has(config.supportRoleId);
}

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  // Deployment Command
  if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    }

    try {
      const ticketChannel = await client.channels.fetch(config.ticketPanelChannelId);
      const appChannel = await client.channels.fetch(config.applicationPanelChannelId);

      const ticketMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Select ticket type")
        .addOptions(
          { label: "Support", value: "support", description: "General help and inquiries." },
          { label: "Report", value: "report", description: "Reporting issues or users." },
          { label: "Book an Event", value: "event", description: "Reserving a time slot for an event." },
          { label: "Annual Leave", value: "annual_leave", description: "Requesting time off." }
        );

      await ticketChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(config.embeds.ticketPanel.title)
            .setDescription(config.embeds.ticketPanel.description)
            .setColor(config.embeds.color)
        ],
        components: [new ActionRowBuilder().addComponents(ticketMenu)]
      });

      const appMenu = new StringSelectMenuBuilder()
        .setCustomId("application_select")
        .setPlaceholder("Select application")
        .addOptions(
          Object.keys(applications).map(key => ({
            label: applications[key].name,
            value: key
          }))
        );

      await appChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(config.embeds.appPanel.title)
            .setDescription(config.embeds.appPanel.description)
            .setColor(config.embeds.color)
        ],
        components: [new ActionRowBuilder().addComponents(appMenu)]
      });

      interaction.reply({ content: "✅ Panels deployed successfully.", ephemeral: true });
    } catch (err) {
      console.error(err);
      interaction.reply({ content: "❌ Error deploying panels. Check channel IDs in .env", ephemeral: true });
    }
  }

  // Ticket Selection
  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const channel = await interaction.guild.channels.create({
      name: `${interaction.values[0]}-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    });

    const closeBtn = new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger);

    channel.send({
      content: `<@&${config.supportRoleId}>`,
      embeds: [
        new EmbedBuilder()
          .setTitle(config.embeds.welcomeTicket.title)
          .setDescription(config.embeds.welcomeTicket.description)
          .addFields({ name: "Category", value: interaction.values[0], inline: true })
          .addFields({ name: "User", value: interaction.user.tag, inline: true })
          .setFooter({ text: config.embeds.welcomeTicket.footer })
          .setColor(config.embeds.color)
          .setTimestamp()
      ],
      components: [new ActionRowBuilder().addComponents(closeBtn)]
    });

    interaction.reply({ content: `🎫 Ticket created: ${channel}`, ephemeral: true });
  }

  // Close Ticket
  if (interaction.isButton() && interaction.customId === "ticket_close") {
    await interaction.reply("Saving transcript and closing...");
    
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = messages.map(m => `[${m.createdAt.toLocaleString()}] ${m.author.tag}: ${m.content}`).reverse().join("\n");

    const fileName = `transcript-${interaction.channel.name}.txt`;
    fs.writeFileSync(fileName, transcript || "No messages");

    const logChannel = await client.channels.fetch(config.transcriptChannel);
    await logChannel.send({ 
      content: `Transcript for ticket: **${interaction.channel.name}**`,
      files: [new AttachmentBuilder(fileName)] 
    });

    fs.unlinkSync(fileName);
    setTimeout(() => interaction.channel.delete(), 5000);
  }

  // Start Application
  if (interaction.isStringSelectMenu() && interaction.customId === "application_select") {
    const appKey = interaction.values[0];
    const app = applications[appKey];
    if (!app) return;

    activeApplications.set(interaction.user.id, {
      app,
      answers: [],
      index: 0
    });

    try {
      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${config.embeds.appStarted.title}: ${app.name}`)
            .setDescription(`**Question 1:** ${app.questions[0]}`)
            .setFooter({ text: config.embeds.appStarted.footer })
            .setColor(config.embeds.color)
        ]
      });
      interaction.reply({ content: "📬 Check your DMs! The application has started.", ephemeral: true });
    } catch (e) {
      interaction.reply({ content: "❌ I couldn't DM you. Please enable Direct Messages.", ephemeral: true });
    }
  }
});

/* ================= APPLICATION ANSWERS ================= */
client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.channel.isDMBased()) return;

  const data = activeApplications.get(message.author.id);
  if (!data) return;

  data.answers.push(`Q: ${data.app.questions[data.index]}\nA: ${message.content}`);
  data.index++;

  if (data.index < data.app.questions.length) {
    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(data.app.name)
          .setDescription(`**Question ${data.index + 1}:** ${data.app.questions[data.index]}`)
          .setColor(config.embeds.color)
      ]
    });
  }

  // Finished Application
  activeApplications.delete(message.author.id);
  message.channel.send("✅ Thank you! Your application has been submitted for review.");

  const fileName = `app-${message.author.username}.txt`;
  const content = `Application: ${data.app.name}\nUser: ${message.author.tag} (${message.author.id})\n\n` + data.answers.join("\n\n");
  
  fs.writeFileSync(fileName, content);

  try {
    const reviewChannel = await client.channels.fetch(config.applicationReviewChannel);
    await reviewChannel.send({ 
      content: `New application submitted by **${message.author.tag}**`,
      files: [new AttachmentBuilder(fileName)] 
    });
  } catch (err) {
    console.error("Could not send application to review channel:", err);
  }

  fs.unlinkSync(fileName);
});

/* ================= LOGIN ================= */
if (!config.token) {
  console.error("ERROR: No token found in .env file!");
} else {
  client.login(config.token);
}
