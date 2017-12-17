const Command = require('../Command.js')
const RichEmbed = require('discord.js').RichEmbed

class Track extends Command {
  constructor(client) {
    super(client, {
      name: 'track',
      group: 'ingame',
      memberName: 'track',
      description: 'Track the live-feed of in-game bots.'
    })
  }

  async run(message, args) {
    args = args.split(' ')

    if (args[0].toLowerCase() === 'tradechat') {
      let guild = message.message.channel.guild.id
      let status = await this.api.get('/warframe/v1/bots/status')
      let previous = {
        user: 'Nexus-Sentry',
        text: 'Trade chat data provided by www.nexus-stats.com',
        region: 'North America (NA) / Europe (EU)'
      }

      // Set tracking state for current guild
      if (!this.api[`$${guild}`]) {
        this.api[`$${guild}`] = {
          state: {}
        }
      }
      let trackTradeChat = this.api[`$${guild}`].state.trackTradeChat

      // Ignore request while already active
      if (trackTradeChat) {
        return
      }

      // If inactive or never set in the first place => set to true
      // That will switch existing listeners back on or set them to begin with
      else {
        this.api[`$${guild}`].state.trackTradeChat = true
      }

      // Set up listeners if not already done for this guild
      // The listener will stay active even on untrack
      if (trackTradeChat === undefined) {

        // Show online status of Nexus-sentry on start
        message.reply(`Started tracking tradechat. Nexus-Sentry status: ${status['Chat-Sentry'].online ? '\`online\`' : '\`offline\`'}`)

        // Subscribe to API
        this.api.subscribe('/warframe/v1/requests')
        this.api.subscribe('/warframe/v1/game/updates')

        // Post on subscription updates
        this.api.on('/warframe/v1/requests', async req => {
          if (this.api[`$${guild}`].state.trackTradeChat && req.subMessage) {
            let current = {}
            let item = (await this.api.get(`/warframe/v1/search?query=${req.item.replace(/ /g, '%20')}`))[0]

            /**
             * Link item names to nexus-stats
             */
            current = {
              user: req.user,
              text: req.subMessage.replace(new RegExp( `(${req.item})`, 'gi' ), `[${req.item}](https://beta.nexus-stats.com${item.webUrl})`),
              region: 'Region: ' + req.region,
            }

            // Text cleanup
            current.text = current.text.split('platinum').join('').split('plat').join('')

            // Assign WTS/WTB if missing due to bad timing on incoming requests
            if (!current.text.toLowerCase().includes('wts') && !current.text.toLowerCase().includes('wtb')) {
              current.text = current.text.split(' ')
              current.text.unshift(req.offer === 'Selling' ? 'WTS' : 'WTB')
              current.text = current.text.join(' ')
            }

            /**
             * Find location of price value and show diff to median
             */
            let stats = await this.api.get(`/warframe/v1/items/${req.item}/statistics`)
            let comp = null
            stats.components.forEach(component => {
              if (component.name === req.component) comp = component
            })

            let diff = req.price - comp.combined.median
            current.text = current.text.split(' ')
            current.text.forEach((word, index) => {
              if (word.includes(req.price)) {
                current.text[index] = `**${req.price}p** (\` ${diff > 0 ? '+' + diff : diff}p\`)`
              }
            })
            current.text = current.text.join(' ')

            /**
             * Extend previous message if same user, otherwise send
             */
            if (current.user === previous.user) {
              current.text = previous.text + ' ' + current.text
            }
            else {
              message.embed(new RichEmbed().setDescription(previous.text).setAuthor(previous.user).setFooter(previous.region))
            }
            previous = current
          }
        })
      }
    }
  }
}

module.exports = Track
