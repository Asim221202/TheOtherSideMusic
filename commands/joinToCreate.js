const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Özel oda ayarlarını sunucu bazında saklamak için bir Map
const sunucuOdaAyarlari = new Map();

module.exports = {
    name: 'oda-olustur-sistemi-ayarla', // Komut adını değiştirdim
    description: 'Özel oda oluşturma sistemini ayarlar (kanal seçimi olmadan).',
    options: [
        {
            name: 'olusturma-kanali',
            type: 7, // Channel Type
            description: 'Kullanıcıların özel oda oluşturmak için katılacağı ses kanalı.',
            required: true,
            channel_types: [2] // Voice Channel
        },
        {
            name: 'kategori',
            type: 7, // Channel Type
            description: 'Özel odaların oluşturulacağı kategori.',
            required: true,
            channel_types: [4] // Category Channel
        },
    ],
    async execute(interaction) {
        const olusturmaKanal = interaction.options.getChannel('olusturma-kanali');
        const kategori = interaction.options.getChannel('kategori');
        const guildId = interaction.guildId;

        // Sunucuya ait ayarları sakla
        sunucuOdaAyarlari.set(guildId, {
            olusturmaKanalId: olusturmaKanal.id,
            kategoriId: kategori.id,
        });

        await interaction.reply({
            content: `Özel oda oluşturma sistemi bu sunucu için ayarlandı!\nOluşturma Kanalı: ${olusturmaKanal.name}\nKategori: ${kategori.name}`,
            ephemeral: true
        });
    },
    async handleVoiceStateUpdate(oldState, newState, client) {
        const guildId = newState.guild.id;
        const ayarlar = sunucuOdaAyarlari.get(guildId);

        if (!ayarlar) return;

        const { olusturmaKanalId, kategoriId } = ayarlar;

        // Kullanıcı belirlenen oluşturma kanalına katıldığında otomatik oda oluştur
        if (newState.channelId === olusturmaKanalId && oldState.channelId !== olusturmaKanalId) {
            const member = newState.member;
            const guild = newState.guild;
            const odaAdi = `${member.displayName}'ın Odası`;

            const kategori = guild.channels.cache.get(kategoriId);
            if (!kategori || kategori.type !== ChannelType.GuildCategory) {
                console.error(`Sunucu ${guildId} için belirtilen kategori bulunamadı veya bir kategori değil.`);
                return;
            }

            try {
                const yeniOda = await guild.channels.create({
                    name: odaAdi,
                    type: ChannelType.GuildVoice,
                    parent: kategoriId,
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [
                                PermissionsBitField.Flags.ManageChannels,
                                PermissionsBitField.Flags.MoveMembers,
                            ],
                        },
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.Connect],
                        },
                    ],
                });

                await member.voice.setChannel(yeniOda);

                const kontrolMesaji = new EmbedBuilder()
                    .setTitle('Oda Kontrol Paneli')
                    .setDescription(`**${yeniOda.name}** adlı odayı yönetmek için aşağıdaki butonları kullanın.`);

                const row1 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('kilitle_' + yeniOda.id)
                            .setLabel('Kilitle')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('ac_' + yeniOda.id)
                            .setLabel('Aç')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('gizle_' + yeniOda.id)
                            .setLabel('Gizle')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('goster_' + yeniOda.id)
                            .setLabel('Göster')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId('isimdegistir_' + yeniOda.id)
                            .setLabel('İsim Değiştir')
                            .setStyle(ButtonStyle.Primary),
                    );

                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('kullaniciekle_' + yeniOda.id)
                            .setLabel('Kullanıcı Ekle')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('kullanicikar_' + yeniOda.id)
                            .setLabel('Kullanıcı Çıkar')
                            .setStyle(ButtonStyle.Danger),
                    );

                const herhangiBirMetinKanalı = newState.guild.channels.cache.find(channel => channel.type === ChannelType.GuildText);
                if (herhangiBirMetinKanalı) {
                    await herhangiBirMetinKanalı.send({ embeds: [kontrolMesaji], components: [row1, row2] });
                } else {
                    console.error(`Sunucu ${guildId} için metin kanalı bulunamadı.`);
                }

            } catch (error) {
                console.error('Özel oda oluşturulurken bir hata oluştu:', error);
            }
        } else if (oldState.channelId !== null && oldState.channel.parentId === kategoriId && oldState.channel.members.size === 0 && oldState.channelId !== olusturmaKanalId) {
            try {
                await oldState.channel.delete();
                console.log(`${oldState.channel.name} adlı özel oda silindi.`);
            } catch (error) {
                console.error('Özel oda silinirken bir hata oluştu:', error);
            }
        }
    },
    async handleInteractionCreate(interaction) {
        if (!interaction.isButton()) return;

        const [komut, odaId] = interaction.customId.split('_');
        const kanal = interaction.guild.channels.cache.get(odaId);

        if (!kanal || kanal.type !== ChannelType.GuildVoice) {
            await interaction.reply({ content: 'Bu buton bu özel oda için geçerli değil.', ephemeral: true });
            return;
        }

        try {
            if (komut === 'kilitle') {
                await kanal.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                await interaction.reply({ content: 'Oda kilitlendi.', ephemeral: true });
            } else if (komut === 'ac') {
                await kanal.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
                await interaction.reply({ content: 'Oda açıldı.', ephemeral: true });
            } else if (komut === 'gizle') {
                await kanal.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                await interaction.reply({ content: 'Oda gizlendi.', ephemeral: true });
            } else if (komut === 'goster') {
                await kanal.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
                await interaction.reply({ content: 'Oda gösterildi.', ephemeral: true });
            } else if (komut === 'isimdegistir') {
                await interaction.reply({ content: 'İsim değiştirme özelliği henüz eklenmedi.', ephemeral: true }); // TODO: Modal ekle
            } else if (komut === 'kullaniciekle') {
                await interaction.reply({ content: 'Kullanıcı ekleme özelliği henüz eklenmedi.', ephemeral: true }); // TODO: Modal veya seçim menüsü ekle
            } else if (komut === 'kullanicikar') {
                await interaction.reply({ content: 'Kullanıcı çıkarma özelliği henüz eklenmedi.', ephemeral: true }); // TODO: Modal veya seçim menüsü ekle
            }
        } catch (error) {
            console.error('Buton etkileşimi işlenirken bir hata oluştu:', error);
            await interaction.reply({ content: 'Bir hata oluştu!', ephemeral: true });
        }
    },
};
