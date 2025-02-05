import dotenv from 'dotenv'
import { AtpAgent } from '@atproto/api'
import fs from 'fs/promises'
import { ids } from '../src/lexicon/lexicons'
import {
  Document,
  Filter,
  MongoClient,
  ObjectId,
  WithoutId,
  SortDirection,
} from 'mongodb'
import { resolveHandleToDID } from '../src/addn/resolveHandleToDID'

const run = async () => {
  dotenv.config()
  const connection_string = `${process.env.FEEDGEN_MONGODB_CONNECTION_STRING}`;
  const handle = `${process.env.FEEDGEN_HANDLE}`
  const password = `${process.env.FEEDGEN_PASSWORD}`
  const service = 'https://bsky.social'
  
  console.log("Logging in to agent")

  const agent = new AtpAgent({ service: service ? service : 'https://bsky.social' })
  await agent.login({ identifier: handle, password})

  let post_uri = process.argv.slice(2)[0]

  console.log("Fetching info for ", post_uri)
  const lastSlashIndex = post_uri.lastIndexOf("/")
  const rkey = post_uri.slice(lastSlashIndex + 1)

  if (!post_uri.includes("did:plc:")) {
    let handle = ""
    const prefix = "https://bsky.app/profile/"

    if (post_uri.includes(prefix)) {
      const startIndex = prefix.length
      const endIndex = post_uri.indexOf("/", startIndex)
      handle = post_uri.slice(startIndex, endIndex)
    } else {
      const endIndex = post_uri.indexOf("/", 0)
      handle = post_uri.slice(0, endIndex)
    }
    
    const did = await resolveHandleToDID(handle, agent)

    post_uri = "at://" + did + "/app.bsky.feed.post/" + rkey
  } else {
    const prefix = "https://bsky.app/profile/"
    let did = ""

    if (post_uri.includes(prefix)) {
      const startIndex = prefix.length
      const endIndex = post_uri.indexOf("/", startIndex)
      did = post_uri.slice(startIndex, endIndex)
    } else {
      const endIndex = post_uri.indexOf("/", 0)
      did = post_uri.slice(0, endIndex)
    }

    post_uri = "at://" + did + "/app.bsky.feed.post/" + rkey
  }

  console.log("final post uri:", post_uri)

  const post = await agent.app.bsky.feed.getPosts(
    {uris: [post_uri]}
  );

  if (!post.success) {
    console.log("Error: no post found for this uri")
    return
  }

  if (!post.data.posts[0].labels) {
    console.log("No labels for post")
  } else {
    console.log("Post labels: ", post.data.posts[0].labels);
  }
  
  return
}

const maybeStr = (val?: string) => {
  if (!val) return undefined
  return val
}


run()
