const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client")
const dotenv = require('dotenv')


dotenv.config();  // Memuat variabel lingkungan dari file .env
process.env.TZ = "Asia/Makassar"

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
    try {
        const now = new Date().toLocaleString("id-ID", {
            timeZone: "Asia/Makassar"
         })
        console.log(now)
        if (msg.fromMe) {
            console.log("pesan keluar");
            if ((msg.from.split('@')[1] != 'g.us') && (msg.to.split('@')[1] != 'g.us')) {
                // cek apakah ada tiket sebelumnya
                const old_ticket = await prisma.ticket.findFirst({
                    where: {
                        is_selesai: false,
                        telepon: msg.to.split('@')[0]
                    }
                })
                console.log(`cek tiket lama: ${old_ticket ? 'ada' : 'tidak ada'}`);
                let ticket_hash = null;
                if (!old_ticket) {
                    console.log("Tidak ada tiket lama, membuat tiket baru");
                    ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp) + msg.to.split('@')[0]).digest("hex")
                    const new_ticket = await prisma.ticket.create({
                        data: {
                            telepon: msg.to.split('@')[0],
                            telepon_anonim: anonymize(msg.to.split('@')[0]),
                            nama: null,
                            nama_anonim: null, // seharusnya ke nama pengguna namun masih ke nama PST
                            chat_pertama: msg.body,
                            ticket_hash: ticket_hash,
                            createdAt : now,
                            updatedAt : now,
                        }
                    })
                    console.log("ticket hash baru : " + ticket_hash)
                } else {
                    ticket_hash = old_ticket.ticket_hash
                    console.log("menggunakan tiket lama : " + ticket_hash)
                }

                const new_conversation = await prisma.conversations.create({
                    data: {
                        ticket_hash: ticket_hash,
                        telepon: msg.from.split('@')[0],
                        telepon_anonim: anonymize(msg.from.split('@')[0]),
                        nama: msg._data.notifyName,
                        nama_anonim: anonymize(msg._data.notifyName),
                        chat: msg.body,
                        createdAt : now,
                        updatedAt : now,
                    }
                })
                console.log("conversation baru dibuat");
                // kalimat end
                if (msg.body == 'Jika sudah tidak ada pertanyaan lagi, ijin kami mengakhiri percakapan ini. Semoga data/informasi yang diberikan di atas bermanfaat.') {
                    const update_ticket = await prisma.ticket.update({
                        where: {
                            ticket_hash: ticket_hash
                        },
                        data: {
                            is_selesai: true,
                            updatedAt : now,
                        }
                    })
                }
            }
        } else {
            console.log("pesan masuk");
            if ((msg.from.split('@')[1] != 'g.us') && (msg.to.split('@')[1] != 'g.us' && msg.from.split('@')[0] != 'status')) {
                // cek apakah ada tiket sebelumnya
                const old_ticket = await prisma.ticket.findFirst({
                    where: {
                        is_selesai: false,
                        telepon: msg.from.split('@')[0]
                    }
                })
                let ticket_hash = null;
                if (!old_ticket) {
                    ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp) + msg.from.split('@')[0]).digest("hex")
                } else {
                    ticket_hash = old_ticket.ticket_hash
                    //cek nama tiket apakah masih NULL atau tidak
                    if (!old_ticket.nama) {
                        const update_ticket = await prisma.ticket.update({
                            where: {
                                ticket_hash: ticket_hash
                            },
                            data: {
                                nama: msg._data.notifyName,
                                nama_anonim: anonymize(msg._data.notifyName),
                                updatedAt : now,
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
                            telepon: msg.from.split('@')[0],
                            telepon_anonim: anonymize(msg.from.split('@')[0]),
                            nama: msg._data.notifyName,
                            nama_anonim: anonymize(msg._data.notifyName),
                            chat_pertama: msg.body,
                            ticket_hash: ticket_hash,
                            createdAt : now,
                            updatedAt : now,
                        }
                    })
                }

                const new_conversation = await prisma.conversations.create({
                    data: {
                        ticket_hash: ticket_hash,
                        telepon: msg.from.split('@')[0],
                        telepon_anonim: anonymize(msg.from.split('@')[0]),
                        nama: msg._data.notifyName,
                        nama_anonim: anonymize(msg._data.notifyName),
                        chat: msg.body,
                        createdAt : now,
                        updatedAt : now,
                    }
                })

            }
        }
    } catch (error) {
        console.log(error)
    }
});


client.initialize();
