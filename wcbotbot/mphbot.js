//mph maked bot on wechat
const { Wechaty } = require('wechaty') //import
Wechaty.instance()
  .on('scan', (url, code) => console.log('Scan QR Code to login: ${code}\n${url}'))
  .on('login',       user => console.log('User ${user} logined'))
  .on('message',  message => console.log('Message: ${message}'))
  .init()