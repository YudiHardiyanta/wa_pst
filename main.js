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

function anonymize(text) {
    // Hilangkan spasi atau tanda pemisah
    try {
        let clean = text;

        // Ambil 3 digit depan & 2 digit belakang
        let prefix = clean.slice(0, 3);
        let suffix = clean.slice(-2);

        // Sisa digit jadi *
        let stars = "*".repeat(clean.length - (prefix.length + suffix.length));

        return prefix + stars + suffix;
    } catch (error) {
        return text
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
        if (msg.fromMe) {
            if ((msg.from.split('@')[1] != 'g.us') && (msg.to.split('@')[1] != 'g.us')) {
                // cek apakah ada tiket sebelumnya
                const old_ticket = await prisma.ticket.findFirst({
                    where : {
                        is_selesai : false,
                        telepon : msg.to.split('@')[0] 
                    }
                })
                if(!old_ticket){
                    const ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp).split(' ')[0] + msg.to.split('@')[0]).digest("hex")
                }else{
                    const ticket_hash = old_ticket.ticket_hash
                }

                const new_conversation = await prisma.conversations.create({
                    data: {
                        ticket_hash: ticket_hash,
                        telepon: msg.from.split('@')[0],
                        telepon_anonim: anonymize(msg.from.split('@')[0]),
                        nama: msg._data.notifyName,
                        nama_anonim: anonymize(msg._data.notifyName),
                        chat: msg.body,
                    }
                })
                // kalimat end
                if (msg.body == 'Jika sudah tidak ada pertanyaan lagi, ijin kami mengakhiri percakapan ini. Data/informasi yang diberikan di atas semoga bermanfaat.') {
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
                // cek apakah ada tiket sebelumnya
                const old_ticket = await prisma.ticket.findFirst({
                    where : {
                        is_selesai : false,
                        telepon : msg.from.split('@')[0] 
                    }
                })
                if(!old_ticket){
                    const ticket_hash = crypto.createHash("sha256").update(toDbDateTime(msg.timestamp).split(' ')[0] + msg.from.split('@')[0]).digest("hex")
                }else{
                    const ticket_hash = old_ticket.ticket_hash
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
                            ticket_hash: ticket_hash
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
                    }
                })

            }
        }
    } catch (error) {
        console.log(error)
    }




});


client.initialize();
