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
  while (await downloadMessages(mailbox.path, 10)) {
    await uploadMessages(mailbox, 100)
  }
  // await downloadMessages(mailbox.path, 10)
  // await uploadMessages(mailbox, 100)
  process.exit()
  // proton.logout()
  // proton.close()
  // db.end()
}

async function downloadMessages (mailboxPath = 'INBOX', count = 1) {
  const i = (await db.query(`SELECT MAX(i) i FROM messages WHERE mailbox = $1`, [mailboxPath])).rows[0].i || 0
  const messages = (await proton.listMessages(mailboxPath, `${i + 1}:${i + count}`, ['uid', 'flags', 'body[]', 'body.peek[]']))
  if (messages.length === 0) return false
  for (const message of messages) {
    console.log(`Downloading messages ${mailboxPath} ${message['#']}`)
    await db.query(`
      INSERT INTO messages (id, mailbox, i, body, seen)
      VALUES ($1, $2, $3, $4, $5)
    `, [ uuid(), mailboxPath, message['#'], message['body[]'], message.flags.includes('\\Seen') ])
  }
  return true
}

async function uploadMessages(mailbox, count = 1) {
  const messages = (await db.query(
    `SELECT * FROM messages WHERE mailbox = $1 AND uploaded IS NULL ORDER BY i LIMIT ${count}`,
    [mailbox.path])).rows
  if (messages.length === 0) return false
  for (const message of messages) {
    console.log(`Uploading messages ${mailbox.path} ${message.i}`)
    await mailbox.upload(message.body)
    await db.query(`UPDATE messages SET uploaded = true WHERE id = $1`, [message.id])
  }
  return true
}

main ()

