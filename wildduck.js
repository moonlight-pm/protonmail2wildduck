const got = require('got')

module.exports = class Wildduck {
  constructor (host = 'localhost', port = 8080) {
    this.host = host
    this.port = port
  }

  async get (path) {
    return (await got(`http://${this.host}:${this.port}/${path}`, {
      json: true
    })).body
  }

  async post (path, data) {
    return (await got.post(`http://${this.host}:${this.port}/${path}`, {
      json: true,
      body: data
    })).body
  }

  async put (path, data) {
    return (await got.put(`http://${this.host}:${this.port}/${path}`, {
      json: true,
      body: data
    })).body
  }

  async delete (path) {
    return (await got.delete(`http://${this.host}:${this.port}/${path}`, {
      json: true
    })).body
  }

  async user (username) {
    const id = (await this.get(`users/resolve/${username}`)).id
    return new User(this, await this.get(`users/${id}`))
  }

  async users () {
    return (await this.get('users')).results.map(u => new User(this, u))
  }

  async addresses () {
    return (await this.get('addresses')).results
  }
}

class User {
  constructor (service, options) {
    this.service = service
    Object.assign(this, options)
  }

  async mailboxes () {
    return (await this.service.get(`users/${this.id}/mailboxes`)).results.map(b => new Mailbox(this, b))
  }

  async addresses () {
    return (await this.service.get(`users/${this.id}/addresses`)).results.map(a => new Address(this, a))
  }

  async createAddress (address) {
    await this.service.post(`users/${this.id}/addresses`, {
      address
    })
  }
}

class Mailbox {
  constructor (user, options) {
    this.user = user
    Object.assign(this, options)
  }

  async upload (message) {
    return (await this.user.service.post(`users/${this.user.id}/mailboxes/${this.id}/messages`, { raw: message })).message.id
  }

  async markUnread (message) {
    await this.user.service.put(`users/${this.user.id}/mailboxes/${this.id}/messages`, {
      message: message.toString(),
      seen: false
    })
  }
}

class Address {
  constructor (user, options) {
    this.user = user
    Object.assign(this, options)
  }

  async update (address) {
    await this.user.service.put(`users/${this.user.id}/addresses/${this.id}`, {
      address
    })
  }

  async delete () {
    await this.user.service.delete(`users/${this.user.id}/addresses/${this.id}`)
  }
}
