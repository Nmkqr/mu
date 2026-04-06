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
      .setDescription('شغّل أغنية')
      .addStringOption(o => o.setName('query').setDescription('الرابط أو اسم الأغنية').setRequired(true)),
    new SlashCommandBuilder().setName('skip').setDescription('تخطي'),
    new SlashCommandBuilder().setName('stop').setDescription('إيقاف'),
    new SlashCommandBuilder().setName('pause').setDescription('إيقاف مؤقت'),
    new SlashCommandBuilder().setName('resume').setDescription('استئناف'),
    new SlashCommandBuilder().setName('queue').setDescription('قائمة الانتظار'),
    new SlashCommandBuilder().setName('nowplaying').setDescription('الأغنية الحالية'),
    new SlashCommandBuilder().setName('volume').addIntegerOption(o => o.setName('level').setMinValue(0).setMaxValue(100).setRequired(true)),
    new SlashCommandBuilder().setName('shuffle').setDescription('خلط'),
    new SlashCommandBuilder().setName('loop').setDescription('تكرار'),
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
    if (!voiceChannel) return interaction.reply({ content: 'ادخل روم صوتي', ephemeral: true });
    await interaction.deferReply();
    const query = interaction.options.getString('query');

    try {
      let video;
      if (query.includes('youtube.com') || query.includes('youtu.be')) {
        const info = await playdl.video_info(query);
        video = info.video_details;
      } else {
        const search = await playdl.search(query, { limit: 1 });
        if (!search.length) return interaction.editReply('❌ ما فيه نتائج');
        video = search[0];
      }

      const customTrack = {
        title: video.title,
        author: video.channel?.name || 'Unknown',
        url: video.url,
        duration: video.durationRaw,
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
  if (!queue) return interaction.reply({ content: 'ما في شيء يشتغل', ephemeral: true });

  switch (commandName) {
    case 'skip': queue.node.skip(); return interaction.reply('⏭ تخطي');
    case 'stop': queue.delete(); return interaction.reply('⏹ إيقاف');
    case 'pause': queue.node.pause(); return interaction.reply('⏸ إيقاف مؤقت');
    case 'resume': queue.node.resume(); return interaction.reply('▶️ استئناف');
    case 'volume': queue.node.setVolume(interaction.options.getInteger('level')); return interaction.reply(`🔊 الصوت ${interaction.options.getInteger('level')}%`);
    case 'shuffle': queue.tracks.shuffle(); return interaction.reply('🔀 خلط');
    case 'loop': queue.setRepeatMode(queue.repeatMode === 1 ? 0 : 1); return interaction.reply(queue.repeatMode === 1 ? '🔁 تكرار' : '➡️ إيقاف التكرار');
    case 'nowplaying': {
      const t = queue.currentTrack;
      const embed = new EmbedBuilder().setTitle(t.title).setURL(t.url).setThumbnail(t.thumbnail);
      return interaction.reply({ embeds: [embed] });
    }
    case 'queue': {
      const tracksList = queue.tracks.toArray().slice(0, 10).map((t, i) => `${i+1}. ${t.title}`).join('\n');
      return interaction.reply(`📋 **قائمة الانتظار:**\n${tracksList || 'فاضية'}`);
    }
  }
});

client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} شغال`);
  await registerCommands();
  console.log('🎵 البوت جاهز للتشغيل');
});

client.login(process.env.DISCORD_TOKEN);
