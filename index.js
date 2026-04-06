const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const { Player } = require('discord-player');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ]
});

const player = new Player(client);

// تسجيل الـ extractors
async function setupPlayer() {
  await player.extractors.loadDefault();
}

// أحداث المشغل
player.events.on('playerStart', (queue, track) => {
  queue.metadata.channel.send(`🎵 يشتغل الآن: **${track.title}** - ${track.author}`);
});

player.events.on('audioTrackAdd', (queue, track) => {
  if (queue.isPlaying()) {
    queue.metadata.channel.send(`➕ أضيف للقائمة: **${track.title}**`);
  }
});

player.events.on('emptyQueue', (queue) => {
  queue.metadata.channel.send('✅ انتهت القائمة');
});

player.events.on('emptyChannel', (queue) => {
  queue.metadata.channel.send('👋 ما في أحد في القناة، خرجت');
});

player.events.on('playerError', (queue, error) => {
  console.error('Player error:', error);
  queue.metadata.channel.send('❌ صار خطأ في التشغيل');
});

// تسجيل الأوامر
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('شغّل أغنية من SoundCloud أو YouTube')
      .addStringOption(o =>
        o.setName('query').setDescription('اسم الأغنية أو رابطها').setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('تخطي الأغنية الحالية'),
    new SlashCommandBuilder().setName('stop').setDescription('إيقاف الموسيقى والخروج'),
    new SlashCommandBuilder().setName('pause').setDescription('إيقاف مؤقت'),
    new SlashCommandBuilder().setName('resume').setDescription('استئناف التشغيل'),
    new SlashCommandBuilder().setName('queue').setDescription('عرض قائمة الانتظار'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('ما يشتغل الآن'),
    new SlashCommandBuilder()
      .setName('volume')
      .setDescription('تغيير الصوت')
      .addIntegerOption(o =>
        o.setName('level').setDescription('0-100').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder().setName('shuffle').setDescription('خلط القائمة'),
    new SlashCommandBuilder().setName('loop').setDescription('تكرار الأغنية الحالية'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ تم تسجيل الأوامر');
}

// معالجة الأوامر
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guildId, member, channel } = interaction;
  const voiceChannel = member.voice?.channel;

  if (commandName === 'play') {
    if (!voiceChannel) {
      return interaction.reply({ content: '🔇 ادخل قناة صوتية أول', ephemeral: true });
    }

    await interaction.deferReply();
    const query = interaction.options.getString('query');

    try {
      const { track } = await player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: { channel },
          selfDeaf: true,
          volume: 80,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 30000,
          leaveOnEnd: false,
        }
      });

      return interaction.editReply(`🎵 جاري التشغيل: **${track.title}**`);
    } catch (e) {
      console.error(e);
      return interaction.editReply('❌ ما قدرت أشغل هذي الأغنية');
    }
  }

  // بقية الأوامر تحتاج player نشط
  const queue = player.nodes.get(guildId);

  if (commandName === 'skip') {
    if (!queue?.isPlaying()) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    queue.node.skip();
    return interaction.reply('⏭ تم التخطي');
  }

  if (commandName === 'stop') {
    if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    queue.delete();
    return interaction.reply('⏹ تم الإيقاف');
  }

  if (commandName === 'pause') {
    if (!queue?.isPlaying()) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    queue.node.pause();
    return interaction.reply('⏸ إيقاف مؤقت');
  }

  if (commandName === 'resume') {
    if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    queue.node.resume();
    return interaction.reply('▶️ استئناف');
  }

  if (commandName === 'volume') {
    if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    const level = interaction.options.getInteger('level');
    queue.node.setVolume(level);
    return interaction.reply(`🔊 الصوت: ${level}%`);
  }

  if (commandName === 'shuffle') {
    if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    queue.tracks.shuffle();
    return interaction.reply('🔀 تم خلط القائمة');
  }

  if (commandName === 'loop') {
    if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    const mode = queue.repeatMode === 1 ? 0 : 1;
    queue.setRepeatMode(mode);
    return interaction.reply(mode === 1 ? '🔁 تكرار الأغنية الحالية' : '➡️ إيقاف التكرار');
  }

  if (commandName === 'nowplaying') {
    if (!queue?.isPlaying()) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    const track = queue.currentTrack;
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('🎵 يشتغل الآن')
      .setDescription(`**${track.title}**`)
      .addFields(
        { name: 'الفنان', value: track.author, inline: true },
        { name: 'المصدر', value: track.source || 'غير معروف', inline: true },
        { name: 'طلب من', value: track.requestedBy?.tag || 'غير معروف', inline: true }
      )
      .setThumbnail(track.thumbnail);
    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === 'queue') {
    if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل', ephemeral: true });
    const tracks = queue.tracks.toArray();
    if (!tracks.length) return interaction.reply('📋 القائمة فاضية');
    const list = tracks.slice(0, 10).map((t, i) => `${i + 1}. **${t.title}**`).join('\n');
    return interaction.reply(`📋 **قائمة الانتظار:**\n${list}${tracks.length > 10 ? `\n...و ${tracks.length - 10} أغاني ثانية` : ''}`);
  }
});

client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} شغال`);
  await setupPlayer();
  await registerCommands();
});

client.login(process.env.DISCORD_TOKEN);
