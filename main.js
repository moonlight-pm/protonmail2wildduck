process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const uuid = require('uuid')
const Imap = require('emailjs-imap-client').default
const Wildduck = require('./wildduck')
const { Client } = require('pg')

const config = require('./config')

const db = new Client(config.pgsql)
const wildduck = new Wildduck(config.wildduck.host)
const proton = new Imap('127.0.0.1', 1143, { logLevel: 'error', auth: config.protonbridge })

async function main () {
  await db.connect()
  await proton.connect()
  const user = await wildduck.user(config.wildduck.user)
  const mailbox = (await user.mailboxes()).filter(b => b.path === 'INBOX')[0]
  await downloadMessages(mailbox.path)
  await uploadMessages(mailbox)
  proton.logout()
  db.end()
}

async function downloadMessages (mailboxPath = 'INBOX', count = 1) {
  const lastUid = (await db.query(`SELECT MAX(uid) uid FROM messages WHERE mailbox = $1`, [mailboxPath])).rows[0].uid || 0
  const messages = (await proton.listMessages(mailboxPath, `${lastUid + 1}:${lastUid + count}`, ['uid', 'flags', 'body[]', 'body.peek[]']))
  if (messages.length === 0) return false
  for (const message of messages) {
    console.log(`Inserting messages ${mailboxPath} ${message.uid}`)
    await db.query(`
      INSERT INTO messages (id, mailbox, uid, body, seen)
      VALUES ($1, $2, $3, $4, $5)
    `, [ uuid(), mailboxPath, message.uid, message['body[]'], message.flags.includes('\\Seen') ])
  }
  return true
}

async function uploadMessages(mailbox, count = 1) {
  const message = (await db.query(`SELECT * FROM messages WHERE uploaded = false ORDER BY uid LIMIT ${count}`)).rows
  if (messages.length === 0) return false
  for (const message of messagese) {
    console.log(`Inserting messages ${mailbox.path} ${message.uid}`)
    await mailbox.upload(message.body)
  }
  return true
}

main ()

