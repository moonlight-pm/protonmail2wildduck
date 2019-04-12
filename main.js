process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const uuid = require('uuid')
const imap = require('imap-simple')
const Wildduck = require('./wildduck')
const { Client } = require('pg')

const config = require('./config')

const db = new Client(config.pgsql)
const wildduck = new Wildduck(config.wildduck.host)
let proton

async function main () {
  const watch = process.argv.includes('watch')
  await db.connect()
  const user = await wildduck.user(config.wildduck.user)
  const mailbox = (await user.mailboxes()).filter(b => b.path === 'INBOX')[0]
  async function check () {
    while (await downloadMessages(mailbox.path, 10)) {
      await uploadMessages(mailbox, 100)
    }
  }
  proton = await imap.connect({
    imap: config.protonbridge,
    onmail: watch ? check : () => {}
  })
  await proton.openBox(mailbox.path)
  if (!watch) {
    await check()
    proton.end()
    db.end()
  }
}

async function downloadMessages (mailboxPath = 'INBOX', count = 1) {
  const i = (await db.query(`SELECT MAX(i) i FROM messages WHERE mailbox = $1`, [mailboxPath])).rows[0].i || 0
  const messages = await proton.search([`${i + 1}:${i + count}`], {
    bodies: ['']
  })
  if (messages.length === 0) return false
  for (const message of messages) {
    console.log(`Downloading message ${mailboxPath} ${message.seqNo}`)
    await db.query(`
      INSERT INTO messages (id, mailbox, i, body, seen)
      VALUES ($1, $2, $3, $4, $5)
    `, [ uuid(), mailboxPath, message.seqNo, message.parts[0].body, message.attributes.flags.includes('\\Seen') ])
  }
  return true
}

async function uploadMessages (mailbox, count = 1) {
  const messages = (await db.query(
    `SELECT * FROM messages WHERE mailbox = $1 AND uploaded IS NULL ORDER BY i LIMIT ${count}`,
    [mailbox.path])).rows
  if (messages.length === 0) return false
  for (const message of messages) {
    console.log(`Uploading message ${mailbox.path} ${message.i}`)
    const mid = await mailbox.upload(message.body)
    await db.query(`UPDATE messages SET uploaded = true WHERE id = $1`, [message.id])
    if (!message.seen) {
      console.log('Marking unread')
      await mailbox.markUnread(mid)
    }
  }
  return true
}

main()
