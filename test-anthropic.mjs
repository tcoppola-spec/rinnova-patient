import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

console.log('Calling Claude...')

const message = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 100,
  messages: [
    { role: 'user', content: 'In one sentence, what is the purpose of a patient health record?' }
  ],
})

console.log('Response from Claude:')
console.log(message.content[0].text)
