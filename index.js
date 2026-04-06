const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const { Player } = require('discord-player');
const playdl = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ]
});

const player = new Player(client);

// أحداث المشغل
player.events.on('playerStart', (queue, track) => {
  queue.metadata.channel.send(`🎵 **يشتغل الآن:** ${track.title}\n👤 ${track.author}`);
});

player.events.on('playerError', (queue, error) => {
  console.error(error);
  queue.metadata.channel.send(`❌ خطأ: ${error.message}`);
});

// تسجيل الأوامر
async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('شغّل أغنية من YouTube')
      .addStringOption(o => o.setName('query').setDescription('الرابط أو اسم الأغنية').setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('تخطي الأغنية الحالية'),
    new SlashCommandBuilder().setName('stop').setDescription('إيقاف الموسيقى والخروج من الروم'),
    new SlashCommandBuilder().setName('pause').setDescription('إيقاف التشغيل مؤقتاً'),
    new SlashCommandBuilder().setName('resume').setDescription('استئناف التشغيل'),
    new SlashCommandBuilder().setName('queue').setDescription('عرض قائمة الانتظار'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('عرض الأغنية التي تشتغل حالياً'),
    new SlashCommandBuilder()
      .setName('volume')
      .setDescription('تغيير مستوى الصوت (0-100)')
      .addIntegerOption(o => o.setName('level').setDescription('مستوى الصوت').setMinValue(0).setMaxValue(100).setRequired(true)),
    new SlashCommandBuilder().setName('shuffle').setDescription('خلط قائمة الانتظار عشوائياً'),
    new SlashCommandBuilder().setName('loop').setDescription('تكرار الأغنية الحالية'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ تم تسجيل الأوامر');
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, guildId, member, channel } = interaction;
  const voiceChannel = member.voice?.channel;

  if (commandName === 'play') {
    if (!voiceChannel) return interaction.reply({ content: '🔇 ادخل روم صوتي أول', ephemeral: true });
    await interaction.deferReply();
    const query = interaction.options.getString('query');

    try {
      let video;
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const info = await playdl.video_info(query);
        video = info.video_details;
      } else {
        const search = await playdl.search(query, { limit: 1 });
        if (!search.length) return interaction.editReply('❌ ما لقيت نتائج لهذا البحث');
        video = search[0];
      }

      const customTrack = {
        title: video.title,
        author: video.channel?.name || 'Unknown',
        url: video.url,
        duration: video.durationRaw || 'Live',
        thumbnail: video.thumbnails?.[0]?.url || '',
        requestedBy: interaction.user,
        async request() {
          const stream = await playdl.stream(video.url);
          return stream.stream;
        }
      };

      await player.play(voiceChannel, customTrack, {
        nodeOptions: {
          metadata: { channel, requestedBy: interaction.user },
          selfDeaf: true,
          volume: 80,
          leaveOnEmpty: true,
        }
      });

      await interaction.editReply(`🎵 **تم التشغيل:** ${video.title}`);
    } catch (e) {
      console.error(e);
      await interaction.editReply(`❌ خطأ: ${e.message}`);
    }
    return;
  }

  const queue = player.nodes.get(guildId);
  if (!queue) return interaction.reply({ content: '❌ ما في شيء يشتغل حالياً', ephemeral: true });

  switch (commandName) {
    case 'skip': queue.node.skip(); return interaction.reply('⏭ تخطي');
    case 'stop': queue.delete(); return interaction.reply('⏹ إيقاف');
    case 'pause': queue.node.pause(); return interaction.reply('⏸ إيقاف مؤقت');
    case 'resume': queue.node.resume(); return interaction.reply('▶️ استئناف');
    case 'volume':
      const level = interaction.options.getInteger('level');
      queue.node.setVolume(level);
      return interaction.reply(`🔊 الصوت ${level}%`);
    case 'shuffle': queue.tracks.shuffle(); return interaction.reply('🔀 خلط القائمة');
    case 'loop':
      const mode = queue.repeatMode === 1 ? 0 : 1;
      queue.setRepeatMode(mode);
      return interaction.reply(mode === 1 ? '🔁 تكرار الأغنية الحالية' : '➡️ إيقاف التكرار');
    case 'nowplaying': {
      const track = queue.currentTrack;
      const embed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle(track.title)
        .setURL(track.url)
        .setThumbnail(track.thumbnail)
        .addFields(
          { name: 'الفنان', value: track.author, inline: true },
          { name: 'المدة', value: track.duration || 'غير محدد', inline: true }
        );
      return interaction.reply({ embeds: [embed] });
    }
    case 'queue': {
      const tracks = queue.tracks.toArray();
      if (!tracks.length) return interaction.reply('📋 القائمة فاضية');
      const list = tracks.slice(0, 10).map((t, i) => `${i+1}. ${t.title}`).join('\n');
      return interaction.reply(`📋 **قائمة الانتظار:**\n${list}${tracks.length > 10 ? `\n...و ${tracks.length-10} أغاني أخرى` : ''}`);
    }
    default: return interaction.reply('أمر غير معروف');
  }
});

// ✅ استخدم clientReady بدلاً من ready
client.once('clientReady', async () => {
  console.log(`🤖 ${client.user.tag} شغال`);
  await registerCommands();
  console.log('🎵 البوت جاهز للتشغيل');
});

client.login(process.env.DISCORD_TOKEN);
