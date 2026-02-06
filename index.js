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

  embedColor: 0x55fe5c,
  applicationTimeout: 60000
};

// Add this temporarily to check your setup in the Railway logs
console.log("--- CONFIG CHECK ---");
Object.entries(config).forEach(([key, value]) => {
  if (value === undefined) {
    console.warn(`⚠️ WARNING: Variable "${key}" is missing!`);
  } else {
    console.log(`✅ ${key} is loaded.`);
  }
});
console.log("--------------------");


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
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
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
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );
  console.log("Slash commands registered");
})();

/* ================= READY ================= */
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ================= STAFF CHECK ================= */
function isStaff(member) {
  return member.roles.cache.has(config.supportRoleId);
}

/* ================= INTERACTIONS ================= */
client.on(Events.InteractionCreate, async interaction => {

  if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: "❌ Staff only.", ephemeral: true });
    }

    const ticketChannel = await client.channels.fetch(config.ticketPanelChannelId);
    const appChannel = await client.channels.fetch(config.applicationPanelChannelId);

    const ticketMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select ticket type")
      .addOptions(
        { label: "Support", value: "support" },
        { label: "Report", value: "report" }
      );

    await ticketChannel.send({
      embeds: [new EmbedBuilder().setTitle("🎫 Tickets").setColor(config.embedColor)],
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
      embeds: [new EmbedBuilder().setTitle("📄 Applications").setColor(config.embedColor)],
      components: [new ActionRowBuilder().addComponents(appMenu)]
    });

    interaction.reply({ content: "✅ Panels deployed.", ephemeral: true });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
        { id: config.supportRoleId, allow: [PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    const closeBtn = new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger);

    channel.send({
      embeds: [new EmbedBuilder().setTitle("🎫 Ticket Opened").setColor(config.embedColor)],
      components: [new ActionRowBuilder().addComponents(closeBtn)]
    });

    interaction.reply({ content: "🎫 Ticket created!", ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === "ticket_close") {
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const transcript = messages.map(m => `[${m.author.tag}] ${m.content}`).reverse().join("\n");

    const file = `ticket-${interaction.channel.id}.txt`;
    fs.writeFileSync(file, transcript || "No messages");

    const log = await client.channels.fetch(config.transcriptChannel);
    await log.send({ files: [new AttachmentBuilder(file)] });

    fs.unlinkSync(file);
    interaction.channel.delete();
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "application_select") {
    const app = applications[interaction.values[0]];
    if (!app) return;

    activeApplications.set(interaction.user.id, {
      app,
      answers: [],
      index: 0
    });

    interaction.reply({ content: "📬 Check your DMs!", ephemeral: true });

    interaction.user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(app.name)
          .setDescription(app.questions[0])
          .setColor(config.embedColor)
      ]
    });
  }
});

/* ================= APPLICATION ANSWERS ================= */
client.on(Events.MessageCreate, async message => {
  if (!message.channel.isDMBased()) return;

  const data = activeApplications.get(message.author.id);
  if (!data) return;

  data.answers.push(message.content);
  data.index++;

  if (data.index < data.app.questions.length) {
    return message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(data.app.name)
          .setDescription(data.app.questions[data.index])
          .setColor(config.embedColor)
      ]
    });
  }

  activeApplications.delete(message.author.id);

  const file = `application-${message.author.id}.txt`;
  fs.writeFileSync(file, data.answers.join("\n"));

  const review = await client.channels.fetch(config.applicationReviewChannel);
  await review.send({ files: [new AttachmentBuilder(file)] });

  fs.unlinkSync(file);
});

/* ================= LOGIN ================= */
client.login(config.token);

