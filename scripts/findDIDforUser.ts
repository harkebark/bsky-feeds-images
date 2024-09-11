import dotenv from 'dotenv'
import { AtpAgent, BlobRef, BskyAgent } from '@atproto/api'
import fs from 'fs/promises'
import { ids } from '../src/lexicon/lexicons'
import { resolveHandleToDID } from '../src/addn/resolveHandleToDID'

const run = async () => {
  dotenv.config()

  // YOUR bluesky handle
  // Ex: user.bsky.social
  const handle = `${process.env.FEEDGEN_HANDLE}`

  // YOUR bluesky password, or preferably an App Password (found in your client settings)
  // Ex: abcd-1234-efgh-5678
  const password = `${process.env.FEEDGEN_PASSWORD}`

  const agent = new BskyAgent({service: 'https://bsky.social'})

  await agent.login({identifier: handle, password: password})

  const target_handle = "xxxxxx.bsky.social"

  const res = await resolveHandleToDID(target_handle, agent)

  console.log(res)

  console.log('All done 🎉')
}

run()
