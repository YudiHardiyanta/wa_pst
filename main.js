const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
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

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const puppeteer = require('puppeteer');



const client = new Client({
    authStrategy: new LocalAuth(),

    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    webVersionCache: {
        type: 'remote',
        // endpoint dengan placeholder {version}
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html',
        strict: false
    }
});

client.on('ready', () => {
    console.log('Ready Gan!');
});

client.on('qr', (qr) => {
    console.log('Scan QR ini untuk login:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('Berhasil login.');
});


// Listen semua pesan (masuk & keluar)
client.on("message_create", async (msg) => {

    if (msg.fromMe) {
        if ((msg.from.split('@')[1] != 'g.us') && (msg.to.split('@')[1] != 'g.us')) {
            // cek apakah sudah ada topik
            const ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp).split(' ')[0] + msg.to.split('@')[0]).digest("hex")

            const new_conversation = await prisma.conversations.create({
                data: {
                    ticket_hash: ticket_hash,
                    telepon: msg.from.split('@')[0],
                    nama: msg._data.notifyName,
                    chat: msg.body,
                }
            })
            // kalimat end
            if (msg.body == 'Terima kasih telah menghubungi Pelayanan Statistik Terpadu (PST) Badan Pusat Statistik (BPS) Provinsi Bali.') {
                const update_ticket = await prisma.ticket.update({
                    where: {
                        ticket_hash: ticket_hash
                    },
                    data: {
                        is_selesai: true
                    }
                })
            }
        }
    } else {
        if ((msg.from.split('@')[1] != 'g.us') && (msg.to.split('@')[1] != 'g.us')) {
            const ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp).split(' ')[0] + msg.from.split('@')[0]).digest("hex")
            const ticket = await prisma.ticket.findUnique({
                where: {
                    ticket_hash: ticket_hash
                }
            })
            if (!ticket) {
                //bikin ticket baru
                const new_ticket = await prisma.ticket.create({
                    data: {
                        telepon: msg.from.split('@')[0],
                        nama: msg._data.notifyName,
                        chat_pertama: msg.body,
                        ticket_hash: ticket_hash
                    }
                })
            }

            const new_conversation = await prisma.conversations.create({
                data: {
                    ticket_hash: ticket_hash,
                    telepon: msg.from.split('@')[0],
                    nama: msg._data.notifyName,
                    chat: msg.body,
                }
            })

        }
    }



});


client.initialize();
