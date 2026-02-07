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
  AuditLogEvent
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
   2. APPLICATION QUESTIONS (EASY TO EDIT)
   ========================================================== */
const applications = {
  staff: {
    name: "Staff Application",
    emoji: "🛡️",
    questions: [
      "Requirements: Own at least 2 DLCS. Must be able to join a VC and listen to instructions. Must Understand and follow instruction given in english. must be willing to follow instructions Must have a stable connection. Must use Green Light CC Profile. Must be Attend 1 event every 2 Months (this may change in future)",
      "Whats your name",
      "what is your discord name",
      "are you over the age of 18",
      "Please Provide link to your TruckersMP Account below",
      "do you lag in TMP",
      "what Role are you appling for on",
      "why do you want to apply for CC",
      "Do you gave any CC experience",
      "what DLCS do you own",
      "How many hour do you have in ETS2",
      "What SCS software titles do you currently own/play",
      "do you gave any experience with being in a convoy control company",
      "Tell us a bit about yourself what are your hobbies?",
      "why would you like to become a member of the cc team?",
      "What can YOU bring to the table!",
      "How did you fine us?"
      
    ]
  },
  Partnership: {
    name: "Green Light Convoy Control Partnership VTC Application",
    emoji: "🤝",
    questions: [
      "Partner Requirements: VTC must have at least 5 or more active members Company must be 2 or more months old and have at least hosted 2 special events! You must not have any relationship with the VTCs on our Blacklist. You must share all your information with us in complete transparency! Must be a member of our Discord Server Must post an ad about our Green Light CC in your Discord server in a dedicated partner channel. Must attend one or more of our Convoys/Events when applicable, failing to do so will result in the partnership being disbanded DO YOU AGREE )",
      "Whats your name",
      "What Your Company Name",
      "What Is Your Position In The Company",
      "What is your Discord username?",
      "Please provide a link to your VTC Page below!",
      "Tell us about yourself and your company! why would you like to partner with us and what can you bring to the table!",
    ]
  },
  EventForm: {
    name: "Need CC For Your Event Form",
    emoji: "📅",
    questions: [
      "Please keep in mind our booking requirements: A fully completed TMP event page is required (except for CC-Scheme members)., Remain in the Green Light CC Discord server and the specific ticket throughout the build up to the event. Leaving the server will be seen as a cancellation of your event!, Slot booking must close at least 3 days before the event., Your event cannot depart before 17:00 UTC (except for CC-Scheme members)., Your route may not exceed 1100 KM (684 ml)., ETS events are only accepted with base game and  DLC's Maps., Your event must have a minimum of 40-50 confirmed event sever  attendees (except for CC-Scheme members). DO YOU AGREE  )",
      "What is your email",
      "What is your name ",
      "What is your VTC name",
      "What Server will your convoy be on, Please choose one",
      "What is your convoy name ",
      "What date would you like to book us for ",
      "What time is the convoy meet up (PLEASE USE UK TIME)",
      "what time do you want the convoy to depart (PLEASE USE UK TIME)",
      "Where is the convoy start location ",
      "What depot do you want the lead to start from ",
      "What is the convoy end destination ",
      "What depot do you want the lead to end at",
      "Event link for Truckers MP",
      "Discord Link",
      "How Many Is Come On Your Convoy From Your VTC",
      "What Team do you need for your VTC convoy on the day",
      "What map DLC'S  will be requirement in the convoy  please tick All the one's  you are use",
      "please send convoy map route in a ticket ",
      "Information OF Your Event",
      "I understand that I have Booked Green Light Convoy Control Team To Do My Event. Thank You For Book Us Today for Your Event From  Green Light CC Team Founder"
    ]
  },
  EventForm: {
    name: "Green Light Convoy Control Apply To become as a driver",
    emoji: "🚚",
    questions: [
      "Requirements: Own all DLCS Must be able to join a VC and listen to instruction Must Understand and Follow instructions given in English Must be willing to Follow instructions Must be to Attend 1 event every 2 Months (this may change in future) Must have a stable connection Use the CC Company Profile Must use the CC Company Skin at all times You Must be over 17 to apply Keep to 56 MPH )",
      "Whats your name",
      "What is your discord name",
      "Your Date Of Birth",
      "Are your over the age of 17",
      "Please provide link to your Truckers MP account below ",
      "IS Your  Truckers MP account full Active ",
      "What DLCs do you own",
      "What Role Are You Applying For on ",
      "What SCS software titles do you currently own/play ",
      "How many hours do you currently have in ETS2 or ATS? ",
      "Why you choose to be a driver  for Green Light CC Company  ",
      "Tell us a bit about yourself, what are your hobbies? why would you like to become a member of the CC  team? what can YOU bring to the table!",
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
  partials: [
    Partials.Channel, 
    Partials.Message, 
    Partials.User, 
    Partials.GuildMember
  ]
});

/* ==========================================================
   5. SLASH COMMAND REGISTRATION
   ========================================================== */
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
    console.log("[SYSTEM] Started refreshing application (/) commands.");
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log("[SYSTEM] Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("[ERROR] Failed to refresh commands:", error);
  }
})();

/* ==========================================================
   6. UTILITY FUNCTIONS
   ========================================================== */
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

async function sendAutoLog(embed) {
  try {
    const channel = await client.channels.fetch(config.botStatsLog);
    if (channel) channel.send({ embeds: [embed] });
  } catch (e) {
    console.error("[ERROR] Logging system failure:", e);
  }
}

/* ==========================================================
   7. AUTO-LOGGING EVENTS
   ========================================================== */

// Message Deletion
client.on(Events.MessageDelete, async message => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle("🗑️ Message Deleted")
    .setColor(0xFF4B4B)
    .addFields(
      { name: "Author", value: `${message.author?.tag || "Unknown"}`, inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      { name: "Content", value: message.content?.substring(0, 1024) || "No text content" }
    )
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
  sendAutoLog(embed);
});

// Message Editing
client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const embed = new EmbedBuilder()
    .setTitle("📝 Message Edited")
    .setColor(0xFFCC4B)
    .addFields(
      { name: "Author", value: `${oldMsg.author.tag}`, inline: true },
      { name: "Channel", value: `${oldMsg.channel}`, inline: true },
      { name: "Before", value: oldMsg.content?.substring(0, 512) || "Empty" },
      { name: "After", value: newMsg.content?.substring(0, 512) || "Empty" }
    )
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
  sendAutoLog(embed);
});

// Member Joins
client.on(Events.GuildMemberAdd, member => {
  const embed = new EmbedBuilder()
    .setTitle("📥 Member Joined")
    .setColor(0x55FE5C)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "ID", value: `${member.id}`, inline: true }
    )
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
  sendAutoLog(embed);
});

// Member Leaves / Kicks
client.on(Events.GuildMemberRemove, async member => {
  const fetchedLogs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick });
  const kickLog = fetchedLogs.entries.first();
  const isKick = kickLog && kickLog.target.id === member.id && (Date.now() - kickLog.createdTimestamp < 5000);

  const embed = new EmbedBuilder()
    .setTitle(isKick ? "👢 Member Kicked" : "📤 Member Left")
    .setColor(isKick ? 0xFFA500 : 0x808080)
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "Reason", value: isKick ? (kickLog.reason || "No reason provided") : "Voluntary departure", inline: true }
    )
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
  sendAutoLog(embed);
});

// Bans
client.on(Events.GuildBanAdd, ban => {
  const embed = new EmbedBuilder()
    .setTitle("🔨 Member Banned")
    .setColor(0x8B0000)
    .addFields(
      { name: "User", value: `${ban.user.tag}`, inline: true },
      { name: "Reason", value: ban.reason || "No reason provided", inline: true }
    )
    .setFooter({ text: config.embeds.footerText })
    .setTimestamp();
  sendAutoLog(embed);
});

/* ==========================================================
   8. READY EVENT
   ========================================================== */
client.once(Events.ClientReady, async () => {
  console.log(`[AUTH] Logged in as ${client.user.tag}`);
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
    } catch (err) { console.error("[ERROR] Failed to send status update:", err); }
  }
});

/* ==========================================================
   9. INTERACTION HANDLER
   ========================================================== */
client.on(Events.InteractionCreate, async interaction => {
  try {
    // Track command stats
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
        .addFields({ name: "Convoy Status", value: "🟠 Waiting for safety inspections..." })
        .setColor(config.embeds.color)
        .setFooter({ text: config.embeds.footerText });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("convoy_check").setLabel("Perform Safety Check").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("convoy_start").setLabel("Depart Now!").setStyle(ButtonStyle.Success).setDisabled(true)
      );

      return interaction.reply({ embeds: [convoyEmbed], components: [row] });
    }

    // --- BUTTON HANDLER ---
    if (interaction.isButton()) {
      // Convoy Check Logic
      if (interaction.customId === "convoy_check") {
        const successChance = Math.random();
        let statusText = "";
        let buttonState = false;

        if (successChance > 0.3) {
          statusText = "✅ **Safety Check Passed!** All engines are green, tires are at pressure, and manifests are signed.";
          buttonState = false;
        } else {
          const failures = ["Engine leak detected!", "Flat tire on trailer!", "Missing paperwork!", "Fuel pump failure!"];
          statusText = `❌ **Safety Check Failed!** ${failures[Math.floor(Math.random() * failures.length)]} Fix the issue and try again.`;
          buttonState = true;
        }

        const editedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setFields({ name: "Convoy Status", value: statusText });
        
        const updatedRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("convoy_check").setLabel("Re-check Vehicles").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("convoy_start").setLabel("Depart Now!").setStyle(ButtonStyle.Success).setDisabled(buttonState)
        );
        
        return interaction.update({ embeds: [editedEmbed], components: [updatedRow] });
      }

      // Convoy Start Logic
      if (interaction.customId === "convoy_start") {
        const events = ["Traffic jam!", "Clear skies!", "Police checkpoint!", "Scenic route chosen!", "Minor delay!"];
        const randomEvent = events[Math.floor(Math.random() * events.length)];

        const finalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
          .setTitle("🚛 Convoy is Rolling!")
          .setDescription(`Departure led by **${interaction.user.username}**.`)
          .setFields(
            { name: "Journey Event", value: `📈 ${randomEvent}` },
            { name: "Status", value: "🟢 En route to destination." }
          );
        return interaction.update({ embeds: [finalEmbed], components: [] });
      }

      // Ticket Closure Logic
      if (interaction.customId === "ticket_close") {
        await interaction.reply("⏳ Processing transcript and closing ticket...");
        
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        let transcriptContent = `TICKET TRANSCRIPT: ${interaction.channel.name}\nClosed By: ${interaction.user.tag}\n----------------------------------\n\n`;
        
        sorted.forEach(m => {
          transcriptContent += `[${new Date(m.createdTimestamp).toLocaleString()}] ${m.author.tag}: ${m.content || "[No Text Content]"}\n`;
        });

        const fileName = `transcript-${interaction.channel.name}.txt`;
        fs.writeFileSync(fileName, transcriptContent);

        try {
          const transChannel = await client.channels.fetch(config.transcriptChannel);
          if (transChannel) {
            await transChannel.send({
              content: `📑 **Ticket Transcript**\nChannel: \`${interaction.channel.name}\`\nClosed By: ${interaction.user}`,
              files: [new AttachmentBuilder(fileName)]
            });
          }
        } catch (err) { console.error("[ERROR] Transcript delivery failed:", err); }

        fs.unlinkSync(fileName);
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }
    }

    // --- DEVLOG COMMAND ---
    if (interaction.isChatInputCommand() && interaction.commandName === "devlog") {
      if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Access Denied: Staff only.", ephemeral: true });
      let mostUsed = "None";
      let maxCount = 0;
      commandUsage.forEach((count, name) => { if (count > maxCount) { maxCount = count; mostUsed = `/${name} (${count})`; } });

      const devLogEmbed = new EmbedBuilder()
        .setTitle("🛠️ Development & Status Log")
        .setColor(config.embeds.color)
        .addFields(
          { name: "⏱️ Uptime", value: getUptime(), inline: true },
          { name: "📊 Popular Command", value: mostUsed, inline: true },
          { name: "🐛 Status", value: "All systems operational.", inline: false }
        )
        .setFooter({ text: config.embeds.footerText });
      return interaction.reply({ embeds: [devLogEmbed] });
    }

    // --- PANEL DEPLOYMENT ---
    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
      if (!isStaff(interaction.member)) return interaction.reply({ content: "❌ Access Denied: Staff only.", ephemeral: true });
      
      const ticketChannel = await client.channels.fetch(config.ticketPanelChannelId);
      const appChannel = await client.channels.fetch(config.applicationPanelChannelId);

      const tMenu = new StringSelectMenuBuilder()
        .setCustomId("ticket_select")
        .setPlaceholder("Why are you contacting us?")
        .addOptions(
          { label: "Support", value: "support", emoji: "🛠️", description: "Get help with server issues" },
          { label: "Report", value: "report", emoji: "⚠️", description: "Report a user or bug" }
        );

      const aMenu = new StringSelectMenuBuilder()
        .setCustomId("application_select")
        .setPlaceholder("Which team do you want to join?")
        .addOptions(
          Object.keys(applications).map(k => ({
            label: applications[k].name,
            value: k,
            emoji: applications[k].emoji || "📝"
          }))
        );

      await ticketChannel.send({
        embeds: [new EmbedBuilder()
          .setTitle(config.embeds.ticketPanel.title)
          .setDescription(config.embeds.ticketPanel.description)
          .setColor(config.embeds.color)
          .setFooter({ text: config.embeds.footerText })
        ],
        components: [new ActionRowBuilder().addComponents(tMenu)]
      });

      await appChannel.send({
        embeds: [new EmbedBuilder()
          .setTitle(config.embeds.appPanel.title)
          .setDescription(config.embeds.appPanel.description)
          .setColor(config.embeds.color)
          .setFooter({ text: config.embeds.footerText })
        ],
        components: [new ActionRowBuilder().addComponents(aMenu)]
      });

      return interaction.reply({ content: "✅ Panels have been deployed successfully.", ephemeral: true });
    }

    // --- SELECT MENU HANDLER ---
    if (interaction.isStringSelectMenu()) {
      // Ticket Creation
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

        const welcome = new EmbedBuilder()
          .setTitle(config.embeds.welcomeTicket.title)
          .setDescription(config.embeds.welcomeTicket.description)
          .setFooter({ text: config.embeds.footerText })
          .setColor(config.embeds.color);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("ticket_close")
            .setLabel("Close & Transcript")
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
          content: `${interaction.user} <@&${config.supportRoleId}>`, 
          embeds: [welcome], 
          components: [row] 
        });

        return interaction.reply({ content: `🎫 Your ticket has been created: ${channel}`, ephemeral: true });
      }

      // Application Initiation
      if (interaction.customId === "application_select") {
        const appKey = interaction.values[0];
        const app = applications[appKey];
        
        activeApplications.set(interaction.user.id, { app, answers: [], index: 0 });
        
        const startEmbed = new EmbedBuilder()
          .setTitle(`📝 ${app.name} Started`)
          .setDescription(`**Question 1:** ${app.questions[0]}`)
          .setFooter({ text: "Please reply to this message with your answer." })
          .setColor(config.embeds.color);

        try { 
          await interaction.user.send({ embeds: [startEmbed] }); 
          return interaction.reply({ content: "📬 We've sent you a DM to start the process.", ephemeral: true }); 
        } catch (e) { 
          return interaction.reply({ content: "❌ I couldn't DM you. Please enable your DMs for this server.", ephemeral: true }); 
        }
      }
    }
  } catch (err) {
    console.error("[CRITICAL ERROR] Interaction failed:", err);
  }
});

/* ==========================================================
   10. MESSAGE HANDLING (APPLICATION DM LOGIC)
   ========================================================== */
client.on(Events.MessageCreate, async message => {
  // Ignore bots and non-DM messages for this logic
  if (message.author.bot || !message.channel.isDMBased()) return;

  const data = activeApplications.get(message.author.id);
  if (!data) return;

  // Store the answer
  data.answers.push(`**Q${data.index + 1}:** ${data.app.questions[data.index]}\n**A:** ${message.content}`);
  data.index++;

  // Check if there are more questions
  if (data.index < data.app.questions.length) {
    const nextQ = new EmbedBuilder()
      .setTitle(`${data.app.name} - Progress`)
      .setDescription(`**Question ${data.index + 1}:** ${data.app.questions[data.index]}`)
      .setColor(config.embeds.color)
      .setFooter({ text: `Question ${data.index + 1} of ${data.app.questions.length}` });
    
    await message.channel.send({ embeds: [nextQ] });
  } else {
    // Application Finished
    activeApplications.delete(message.author.id);
    
    const finishedEmbed = new EmbedBuilder()
      .setTitle("Application Submitted")
      .setDescription("✅ Thank you! Your application has been sent to the staff team for review.")
      .setColor(config.embeds.color);
    
    await message.channel.send({ embeds: [finishedEmbed] });
    
    // Send to Review Channel
    try {
      const reviewChannel = await client.channels.fetch(config.applicationReviewChannel);
      const fileName = `application-${message.author.username}-${Date.now()}.txt`;
      
      const fileContent = `APPLICATION: ${data.app.name}\nUSER: ${message.author.tag} (${message.author.id})\nSUBMITTED: ${new Date().toLocaleString()}\n\n` + data.answers.join("\n\n");
      
      fs.writeFileSync(fileName, fileContent);
      
      await reviewChannel.send({ 
        content: `🆕 **New Application Received**\n**Type:** ${data.app.name}\n**User:** ${message.author}`, 
        files: [new AttachmentBuilder(fileName)] 
      });
      
      fs.unlinkSync(fileName);
    } catch (err) { 
      console.error("[ERROR] Failed to send application for review:", err); 
    }
  }
});

/* ==========================================================
   11. CLIENT LOGIN
   ========================================================== */
client.login(config.token);

// End of Script - Full System Operational
