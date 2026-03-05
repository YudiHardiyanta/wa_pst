const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client")
const dotenv = require('dotenv')


dotenv.config();  // Memuat variabel lingkungan dari file .env

const prisma = new PrismaClient();


function toDbDateTime(timestamp) {
    // convert ke milidetik
    const date = new Date((timestamp + 8 * 3600) * 1000); // shift ke UTC+8

    const pad = (n) => String(n).padStart(2, "0");

    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}



function anonymize(text) {
    // Hilangkan spasi atau tanda pemisah
    let clean = text;

    // Ambil 3 digit depan & 2 digit belakang
    let prefix = clean.slice(0, 3);
    let suffix = clean.slice(-2);
    try {
        // Sisa digit jadi *
        let stars = "*".repeat(clean.length - (prefix.length + suffix.length));
        return prefix + stars + suffix;
    } catch (error) {
        let stars = "*".repeat(text.length);
        return prefix + stars + suffix;
    }

}

const puppeteer = require('puppeteer');




const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
});


client.on('qr', (qr) => {
    console.log('Scan QR ini untuk login:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('Berhasil login.');
});


client.on('ready', async () => {
    console.log('Client siap!');

    const chats = await client.getChats();

    for (let chat of chats) {

        // ✅ Hanya chat personal
        if (!chat.isGroup) {

            console.log(`Ambil chat personal: ${chat.name || chat.id.user}`);

            const messages = await chat.fetchMessages({ limit: 300 });

            for (let msg of messages) {
                try {
                    const contact = await msg.getContact();

                    const data = {
                        phone: contact.number,
                        name: contact.pushname || contact.name || "Tidak diketahui",
                        time: msg.timestamp * 1000,
                        type: msg.type,
                        chat: msg.body,
                        fromMe: msg.fromMe,
                        chatName: chat.name || chat.id.user,
                        chatNumber: chat.id.user

                    };



                    if (msg.fromMe && msg.type == 'chat') {
                        const old_ticket = await prisma.ticket.findFirst({
                            where: {
                                is_selesai: false,
                                telepon: data.chatNumber
                            }
                        })

                        if (!old_ticket) {
                            //console.log("Tidak ada tiket lama, membuat tiket baru");
                            ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp) + data.chatNumber).digest("hex")
                            const new_ticket = await prisma.ticket.create({
                                data: {
                                    telepon: data.chatNumber,
                                    telepon_anonim: anonymize(data.chatNumber),
                                    nama: null,
                                    nama_anonim: null, // seharusnya ke nama pengguna namun masih ke nama PST
                                    chat_pertama: data.chat,
                                    ticket_hash: ticket_hash,
                                    createdAt: toDbDateTime(msg.timestamp),
                                    updatedAt: toDbDateTime(msg.timestamp),
                                }
                            })
                            //console.log("ticket hash baru : " + ticket_hash)
                        } else {
                            ticket_hash = old_ticket.ticket_hash
                            //console.log("menggunakan tiket lama : " + ticket_hash)
                        }

                        const new_conversation = await prisma.conversations.create({
                            data: {
                                ticket_hash: ticket_hash,
                                telepon: data.chatNumber,
                                telepon_anonim: anonymize(data.chatNumber),
                                nama: "Badan Pusat Statistik Provinsi Bali",
                                nama_anonim: anonymize("Badan Pusat Statistik Provinsi Bali"),
                                chat: data.chat,
                                createdAt: toDbDateTime(msg.timestamp),
                                updatedAt: toDbDateTime(msg.timestamp),
                            }
                        })
                    } 
                    if (!msg.fromMe && msg.type == 'chat')
                    {

                        const old_ticket = await prisma.ticket.findFirst({
                            where: {
                                is_selesai: false,
                                telepon: data.chatNumber
                            }
                        })
                        let ticket_hash = null;
                        if (!old_ticket) {
                            ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp) + data.chatNumber).digest("hex")
                        } else {
                            ticket_hash = old_ticket.ticket_hash
                            //cek nama tiket apakah masih NULL atau tidak
                            if (!old_ticket.nama) {
                                const update_ticket = await prisma.ticket.update({
                                    where: {
                                        ticket_hash: ticket_hash
                                    },
                                    data: {
                                        nama: data.name,
                                        nama_anonim: anonymize(data.name),
                                        updatedAt: toDbDateTime(msg.timestamp),
                                    }
                                })
                            }
                        }

                        const ticket = await prisma.ticket.findUnique({
                            where: {
                                ticket_hash: ticket_hash
                            }
                        })
                        if (!ticket) {
                            //bikin ticket baru
                            const new_ticket = await prisma.ticket.create({
                                data: {
                                    telepon: data.phone,
                                    telepon_anonim: anonymize(data.phone),
                                    nama: data.name,
                                    nama_anonim: anonymize(data.name),
                                    chat_pertama: data.chat,
                                    ticket_hash: ticket_hash,
                                    createdAt: toDbDateTime(msg.timestamp),
                                    updatedAt: toDbDateTime(msg.timestamp),
                                }
                            })
                        }

                        const new_conversation = await prisma.conversations.create({
                            data: {
                                ticket_hash: ticket_hash,
                                telepon: data.phone,
                                telepon_anonim: anonymize(data.phone),
                                nama: data.name,
                                nama_anonim: anonymize(data.name),
                                chat: data.chat,
                                createdAt: toDbDateTime(msg.timestamp),
                                updatedAt: toDbDateTime(msg.timestamp),
                            }
                        })


                    }

                } catch (error) {
                    console.log(error)
                }
            }
        }
    }

    console.log("Backup chat personal selesai!");
});

client.initialize();