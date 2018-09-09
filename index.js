#!/usr/bin/env node

const program = require('commander')

program
  .version('1.0.0', '-v, --version')
  .option('-s, --server <url>', 'URL to MQTT server to connect to', 'mqtt://localhost')
  .option('-u, --user <user>', 'MQTT username')
  .option('-p, --password <password>', 'MQTT password')
  .option('-t, --root-topic <root-topic>', 'MQTT root topic', false)
  .option('--verbose', 'Show information about all processed messages', false)
  .option('--preamble <length>', 'Set preamble length', '1FE0')
  .option('--pulse-high <length>', 'Set high pulse length', '0118')
  .option('--pulse-low <length>', 'Set low pulse length', '030C')
  .parse(process.argv)

if (!program.rootTopic) {
  console.error('ERROR: Root topic not specified')
  process.exit(1)
}

const mqtt = require('mqtt').connect(program.server)
const match = require('mqtt-match')

const processors = {
  [`${program.rootTopic}/rfin`]: ({ message }) => {
    message = message.toString()
    const code = message.substring(12, 18)
    if (program.verbose) {
      console.log(`IN : code ${code} - reposting to ${program.rootTopic}/rfin/${code}`)
    }
    mqtt.publish(`${program.rootTopic}/rfin/${code}`, '1')
  },

  [`${program.rootTopic}/rfout/set/+`]: ({ topic }) => {
    const code = topic.substring(27, 33)
    const message = `${program.preamble}${program.pulseHigh}${program.pulseLow}${code}`
    if (program.verbose) {
      console.log(`OUT: code ${code} - reposting to ${program.rootTopic}/rfout/set with payload ${message}`)
    }
    mqtt.publish(`${program.rootTopic}/rfout/set`, message)
  }
}

mqtt.on('connect', () => {
  console.log(`Connected to MQTT at ${program.server}`)
  for (const topic in processors) {
    console.log(`Subscribing to "${topic}"`)
    mqtt.subscribe(topic)
  }
})

mqtt.on('message', (topic, message) => {
  for (const subscription in processors) {
    if (match(subscription, topic)) {
      if (program.verbose) {
        console.log(`Received message on topic ${topic} with payload ${message}`)
      }
      processors[subscription]({ topic, message })
    }
  }
})
